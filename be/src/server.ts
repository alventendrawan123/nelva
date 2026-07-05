// Nelva BE gateway. Routes talk to the Ledger interface (mock or real Canton —
// LEDGER_MODE env). REST contract = docs/2_TECH_SPEC §5/§6. FE is unaffected by
// which ledger backs it.
import express, { Request, Response } from "express";
import cors from "cors";
import { roleOf } from "./types.js";
import { ledger, LEDGER_MODE } from "./ledger.js";

const PORT = Number(process.env.PORT ?? 8090); // 8080 often taken (Apache/XAMPP)
const app = express();
// trust proxy is deployment-specific: X-Forwarded-For is only trustworthy behind a
// known number of proxies. Default to 0 (direct exposure) so req.ip is the real socket
// peer and can't be spoofed; set TRUST_PROXY=1 (or n) when behind Railway/Vercel/etc.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));
// CORS: lock to the FE origin(s) in prod via FE_ORIGIN (comma-separated). Unset = allow-all (local dev).
const FE_ORIGIN = process.env.FE_ORIGIN;
app.use(cors(FE_ORIGIN ? { origin: FE_ORIGIN.split(",").map((s) => s.trim()) } : {}));
app.use(express.json());

// Dependency-free in-memory rate limit — blunts API abuse on a public URL.
const RL_WINDOW = 60_000, RL_MAX = 240;
const rlHits = new Map<string, { n: number; t: number }>();
app.use((req, res, next) => {
  const now = Date.now();
  const ip = req.ip ?? "?";
  const e = rlHits.get(ip);
  if (!e || now - e.t > RL_WINDOW) rlHits.set(ip, { n: 1, t: now });
  else if (e.n >= RL_MAX) return res.status(429).json({ error: "rate limit exceeded" });
  else e.n++;
  if (rlHits.size > 5000) for (const [k, v] of rlHits) if (now - v.t > RL_WINDOW) rlHits.delete(k);
  next();
});

function who(req: Request): { party?: string; role: ReturnType<typeof roleOf> } {
  const auth = req.header("authorization") ?? "";
  const party = auth.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  return { party: party || undefined, role: roleOf(party || undefined) };
}
// Map a thrown error to an HTTP status + a SANITIZED body. Validation errors thrown by
// the BE (with e.status or a plain message) surface as-is; raw ledger errors are
// classified (not-found -> 409, authorization -> 403, connectivity/5xx -> 502) and their
// internal ids (contractId/traceId/participant) are NOT echoed to the client.
function classifyError(e: any): { status: number; body: any } {
  if (e && typeof e.status === "number" && !e.ledger) return { status: e.status, body: { error: String(e.message ?? e) } };
  const msg = String(e?.message ?? e);
  const code = e?.code ?? (/"code":"([A-Z_]+)"/.exec(msg)?.[1]);
  if (e?.ledger) {
    if (code === "CONTRACT_NOT_FOUND" || /(-> 404\b|NOT_FOUND)/.test(msg)) return { status: 409, body: { error: "ledger state changed (contract not found); retry", code } };
    if (code === "DAML_AUTHORIZATION_ERROR" || /-> 403\b/.test(msg)) return { status: 403, body: { error: "not authorized for this operation", code } };
    if (/-> 5\d\d\b|fetch failed|ECONNREFUSED|ENOTFOUND/.test(msg)) return { status: 502, body: { error: "ledger unavailable", code } };
    return { status: 400, body: { error: "ledger rejected the request", code } };
  }
  return { status: 400, body: { error: msg } };
}
// wrap an async handler -> classified, sanitized error
const h = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response) => {
  fn(req, res).catch((e: any) => { const { status, body } = classifyError(e); res.status(status).json(body); });
};
function requireParty(req: Request, res: Response): string | null {
  const { party } = who(req);
  if (!party) { res.status(401).json({ error: "missing Authorization: Bearer <party>" }); return null; }
  return party;
}
// NOTE: dev auth trusts the Bearer token AS the party name. Fine for a LOCALHOST
// demo; for a network-exposed deployment, enable real JWT validation (canton mode
// validates outbound; add inbound issuer/sig/exp/aud checks here). requireRole at
// least enforces correct role semantics on sensitive routes.
function requireRole(req: Request, res: Response, role: string): string | null {
  const { party, role: r } = who(req);
  if (!party) { res.status(401).json({ error: "missing Authorization: Bearer <party>" }); return null; }
  if (r !== role) { res.status(403).json({ error: `requires role: ${role}` }); return null; }
  return party;
}
// A per-:party read is only allowed to the party itself or a privileged role
// (operator/auditor). Blocks anonymous/rival scraping of another party's dashboards.
function requireSelfOrPrivileged(req: Request, res: Response, subject: string): string | null {
  const { party, role } = who(req);
  if (!party) { res.status(401).json({ error: "missing Authorization: Bearer <party>" }); return null; }
  if (party === subject || role === "operator" || role === "auditor") return party;
  res.status(403).json({ error: "forbidden: not your data" }); return null;
}
function posNum(v: any, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid ${name}: must be a positive number`);
  return n;
}
function nonNegNum(v: any, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${name}: must be a non-negative number`);
  return n;
}
// duration in whole days, 1..3650 (10y). Guards NaN/negative/absurd inputs.
function durDays(v: any): number {
  if (v == null) return 30;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 3650 || !Number.isInteger(n)) throw new Error("invalid durationDays: integer 1..3650");
  return n;
}

// ── auth ──
app.post("/api/login", h(async (req, res) => {
  const party = String(req.body?.party ?? "").trim();
  if (!party) throw new Error("party required");
  res.json({ token: party, party, role: roleOf(party) });
}));
app.get("/api/me", h(async (req, res) => {
  const w = who(req);
  res.json({ ...w, partyId: w.party ? await ledger.partyId(w.party) : null });
}));
app.get("/api/holdings", h(async (req, res) => res.json(await ledger.holdings(who(req).party))));

// ── wallet: external-party signing relay (the user's key stays in their browser) ──
app.post("/api/wallet/onboard", h(async (req, res) => {
  const { partyHint, publicKey } = req.body ?? {};
  if (!partyHint || !publicKey) throw new Error("partyHint + publicKey required");
  res.json(await ledger.walletOnboard(String(partyHint), String(publicKey)));
}));
app.post("/api/wallet/allocate", h(async (req, res) => {
  const { topologyTransactions, fingerprint, multiHashSignature } = req.body ?? {};
  if (!Array.isArray(topologyTransactions) || !fingerprint || !multiHashSignature) throw new Error("topologyTransactions + fingerprint + multiHashSignature required");
  res.json(await ledger.walletAllocate(topologyTransactions, String(fingerprint), String(multiHashSignature)));
}));
app.post("/api/wallet/prepare", h(async (req, res) => {
  const { party, commands, disclosedContracts } = req.body ?? {};
  if (!party || !Array.isArray(commands)) throw new Error("party + commands[] required");
  res.json(await ledger.walletPrepare(String(party), commands, Array.isArray(disclosedContracts) ? disclosedContracts : []));
}));
app.get("/api/wallet/accept-info", h(async (req, res) => {
  // returns matched SealedBid blobs (rivals' locked funds) — authenticated callers only.
  if (!requireParty(req, res)) return;
  res.json(await ledger.walletAcceptInfo(String(req.query.proposalId ?? "")));
}));
app.get("/api/wallet/repay-info", h(async (req, res) => res.json(await ledger.walletRepayInfo(String(req.query.party ?? ""), String(req.query.loanId ?? "")))));
app.post("/api/faucet", h(async (req, res) => {
  // fund the CALLER only (never a body-supplied party) so it can't be used to mint to
  // arbitrary/unbounded party names.
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.walletFaucet(party));
}));
app.post("/api/wallet/execute", h(async (req, res) => {
  const { party, preparedTransaction, hashingSchemeVersion, fingerprint, signature } = req.body ?? {};
  if (!party || !preparedTransaction || !hashingSchemeVersion || !fingerprint || !signature) throw new Error("party + preparedTransaction + hashingSchemeVersion + fingerprint + signature required");
  res.json(await ledger.walletExecute(String(party), preparedTransaction, String(hashingSchemeVersion), String(fingerprint), String(signature)));
}));
app.get("/api/config", h(async (_req, res) => res.json(await ledger.config())));
// Is a wallet party actually allocated on this ledger? FE calls this on re-attach to
// detect a "zombie" party (in localStorage but unknown to the ledger) and re-onboard.
app.get("/api/wallet/known", h(async (req, res) => {
  const party = String(req.query.party ?? "").trim();
  res.json({ known: party ? await ledger.partyKnown(party) : false });
}));
app.get("/api/wallet/holdings", h(async (req, res) => res.json(await ledger.walletHoldings(who(req).party ?? ""))));

// ── lender ──
app.post("/api/bids", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { amount, rate, instrument, durationDays } = req.body ?? {};
  res.status(201).json(await ledger.createBid(party, { amount: posNum(amount, "amount"), rate: posNum(rate, "rate"), instrument, durationDays: durDays(durationDays) }));
}));
app.get("/api/bids", h(async (req, res) => res.json(await ledger.listBids(who(req).party))));
app.delete("/api/bids/:id", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.withdrawBid(party, req.params.id));
}));

// ── borrower ──
app.post("/api/borrow", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { amount, maxRate, collateralAmount, instrument } = req.body ?? {};
  res.status(201).json(await ledger.createBorrow(party, { amount: posNum(amount, "amount"), maxRate: posNum(maxRate, "maxRate"), collateralAmount: posNum(collateralAmount, "collateralAmount"), instrument }));
}));
app.get("/api/borrow", h(async (req, res) => res.json(await ledger.listBorrows(who(req).party))));
app.get("/api/proposals", h(async (req, res) => res.json(await ledger.listProposals(who(req).party))));
app.post("/api/proposals/:id/accept", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.accept(party, req.params.id));
}));
app.post("/api/proposals/:id/reject", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.reject(party, req.params.id));
}));
app.get("/api/loans", h(async (req, res) => res.json(await ledger.listLoans(who(req).party))));
app.post("/api/loans/:id/repay", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.repay(party, req.params.id));
}));

// ── cancel-borrow + claim-excess (SC-backed) ──
app.delete("/api/borrow/:id", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.cancelBorrow(party, req.params.id));
}));
app.post("/api/loans/:id/claim-excess", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.claimExcess(party, req.params.id));
}));

// ── 2-phase lend ──
app.post("/api/lend/init", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { amount, instrument, durationDays } = req.body ?? {};
  res.status(201).json(await ledger.lendInit(party, { amount: posNum(amount, "amount"), instrument, durationDays: durDays(durationDays) }));
}));
app.post("/api/lend/confirm", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { slotId, rate } = req.body ?? {};
  if (!slotId) throw new Error("slotId required");
  res.status(201).json(await ledger.lendConfirm(party, String(slotId), posNum(rate, "rate")));
}));

// ── swap ──
app.get("/api/swap-quote", h(async (req, res) => {
  const instrumentIn = String(req.query.instrumentIn ?? "");
  const instrumentOut = String(req.query.instrumentOut ?? "");
  if (!instrumentIn || !instrumentOut) throw new Error("instrumentIn + instrumentOut required");
  if (instrumentIn === instrumentOut) throw new Error("instrumentIn and instrumentOut must differ");
  const amountIn = posNum(req.query.amountIn, "amountIn");
  res.json(await ledger.swapQuote({ instrumentIn, instrumentOut, amountIn }));
}));
app.post("/api/swap", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { instrumentIn, instrumentOut, amountIn, minAmountOut } = req.body ?? {};
  if (!instrumentIn || !instrumentOut) throw new Error("instrumentIn + instrumentOut required");
  if (instrumentIn === instrumentOut) throw new Error("instrumentIn and instrumentOut must differ");
  res.status(201).json(await ledger.swap(party, {
    instrumentIn: String(instrumentIn),
    instrumentOut: String(instrumentOut),
    amountIn: posNum(amountIn, "amountIn"),
    minAmountOut: minAmountOut != null ? nonNegNum(minAmountOut, "minAmountOut") : undefined,
  }));
}));

// ── collateral quote (scoped: caller must be the subject or privileged) ──
app.get("/api/collateral-quote", h(async (req, res) => {
  const party = String(req.query.party ?? "").trim();
  if (!party) throw new Error("party required");
  if (!requireSelfOrPrivileged(req, res, party)) return;
  const amount = posNum(req.query.amount, "amount");
  const instrument = String(req.query.instrument ?? "USD");
  res.json(await ledger.collateralQuote(party, amount, instrument));
}));

// ── consolidated per-party dashboards (scoped: self or operator/auditor only) ──
app.get("/api/lender-status/:party", h(async (req, res) => {
  if (!requireSelfOrPrivileged(req, res, req.params.party)) return;
  res.json(await ledger.lenderStatus(req.params.party));
}));
app.get("/api/borrower-status/:party", h(async (req, res) => {
  if (!requireSelfOrPrivileged(req, res, req.params.party)) return;
  res.json(await ledger.borrowerStatus(req.params.party));
}));
app.get("/api/credit-score/:party", h(async (req, res) => {
  if (!requireSelfOrPrivileged(req, res, req.params.party)) return;
  res.json(await ledger.creditScore(req.params.party));
}));

// ── public marketplace feed (ungated, aggregate-only) ──
app.get("/api/market", h(async (_req, res) => res.json(await ledger.market())));

// ── operator (admin / demo controls) — operator role only ──
app.post("/api/admin/run-match", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; res.json({ proposals: await ledger.runMatch() }); }));
app.post("/api/admin/cheat-match", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; res.json({ proposals: await ledger.runCheatMatch() }); }));
app.post("/api/admin/price", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; res.json(await ledger.setPrice(String(req.body?.instrument ?? "USD"), posNum(req.body?.price, "price"))); }));
app.post("/api/admin/liquidate/:loanId", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; res.json(await ledger.liquidate(req.params.loanId)); }));
app.post("/api/admin/seed", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; await ledger.seed(); res.json({ ok: true }); }));
app.post("/api/admin/expire-proposals", h(async (req, res) => { if (!requireRole(req, res, "operator")) return; res.json(await ledger.expireProposals()); }));

// ── auditor (differentiator) — auditor role only ──
app.get("/api/audit/bids", h(async (req, res) => { if (!requireRole(req, res, "auditor")) return; res.json(await ledger.auditBids()); }));
app.post("/api/audit/verify/:proposalId", h(async (req, res) => {
  const party = requireRole(req, res, "auditor"); if (!party) return;
  res.json(await ledger.verify(party, req.params.proposalId));
}));
app.get("/api/audit/badges", h(async (req, res) => { if (!requireParty(req, res)) return; res.json(await ledger.listBadges()); }));

// ── lens (hero) — perspective is scoped to the CALLER. Anonymous callers get the
// outsider view (status only); the full multi-perspective teaching view requires an
// operator/auditor Bearer. Never serves every sealed rate to an unauthenticated caller.
app.get("/api/lens", h(async (req, res) => {
  const { party, role } = who(req);
  res.json(await ledger.lens(String(req.query.proposalId ?? ""), party, role));
}));
app.get("/api/status", h(async (_req, res) => res.json(await ledger.status())));
app.get("/api/health", (_req, res) => res.json({ ok: true, mode: LEDGER_MODE }));

// Listen FIRST so /api/health goes green immediately (a slow/failing seed must not
// crashloop the container behind a platform healthcheck). Seed + the auto-matcher run
// after the port is open; a seed failure is logged, not fatal.
app.listen(PORT, () => {
  console.log(`Nelva BE (${LEDGER_MODE}) on http://localhost:${PORT}  — GET /api/status`);
  ledger.seed()
    .then(() => console.log("seeded."))
    .catch((e) => console.error("seed failed (continuing, /api/health still up):", e?.message ?? e));
  // Auto-matching engine: periodically run the operator match so wallet users'
  // bids/borrows settle on their own (like a scheduled matcher). runMatch throws
  // when there's nothing to pair — ignore. Canton mode only.
  if (LEDGER_MODE === "canton") {
    setInterval(() => { ledger.runMatch().catch(() => {}); }, 20000);
    setInterval(() => { ledger.expireProposals().catch(() => {}); }, 20000);
  }
});
