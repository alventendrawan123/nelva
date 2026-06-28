// Nelva BE gateway. Routes talk to the Ledger interface (mock or real Canton —
// LEDGER_MODE env). REST contract = docs/2_TECH_SPEC §5/§6. FE is unaffected by
// which ledger backs it.
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { roleOf } from "./types.js";
import { ledger, LEDGER_MODE } from "./ledger.js";

const PORT = Number(process.env.PORT ?? 8090); // 8080 often taken (Apache/XAMPP)
const app = express();
app.use(cors());
app.use(express.json());

function who(req: Request): { party?: string; role: ReturnType<typeof roleOf> } {
  const auth = req.header("authorization") ?? "";
  const party = auth.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  return { party: party || undefined, role: roleOf(party || undefined) };
}
// wrap an async handler -> 400 on error
const h = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, _n: NextFunction) => {
  fn(req, res).catch((e: any) => res.status(400).json({ error: String(e?.message ?? e) }));
};
function requireParty(req: Request, res: Response): string | null {
  const { party } = who(req);
  if (!party) { res.status(401).json({ error: "missing Authorization: Bearer <party>" }); return null; }
  return party;
}

// ── auth ──
app.post("/api/login", h(async (req, res) => {
  const party = String(req.body?.party ?? "").trim();
  if (!party) throw new Error("party required");
  res.json({ token: party, party, role: roleOf(party) });
}));
app.get("/api/me", h(async (req, res) => res.json(who(req))));

// ── lender ──
app.post("/api/bids", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  const { amount, rate, instrument, durationDays } = req.body ?? {};
  res.status(201).json(await ledger.createBid(party, { amount: Number(amount), rate: Number(rate), instrument, durationDays: Number(durationDays ?? 30) }));
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
  res.status(201).json(await ledger.createBorrow(party, { amount: Number(amount), maxRate: Number(maxRate), collateralAmount: Number(collateralAmount), instrument }));
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

// ── operator (admin / demo controls) ──
app.post("/api/admin/run-match", h(async (_req, res) => res.json({ proposals: await ledger.runMatch() })));
app.post("/api/admin/cheat-match", h(async (_req, res) => res.json({ proposals: await ledger.runCheatMatch() })));
app.post("/api/admin/price", h(async (req, res) => res.json(await ledger.setPrice(String(req.body?.instrument ?? "USD"), Number(req.body?.price)))));
app.post("/api/admin/liquidate/:loanId", h(async (req, res) => res.json(await ledger.liquidate(req.params.loanId))));
app.post("/api/admin/seed", h(async (_req, res) => { await ledger.seed(); res.json({ ok: true }); }));

// ── auditor (differentiator) ──
app.get("/api/audit/bids", h(async (_req, res) => res.json(await ledger.auditBids())));
app.post("/api/audit/verify/:proposalId", h(async (req, res) => {
  const party = requireParty(req, res); if (!party) return;
  res.json(await ledger.verify(party, req.params.proposalId));
}));
app.get("/api/audit/badges", h(async (_req, res) => res.json(await ledger.listBadges())));

// ── lens (hero) + public ──
app.get("/api/lens", h(async (req, res) => res.json(await ledger.lens(String(req.query.proposalId ?? "")))));
app.get("/api/status", h(async (_req, res) => res.json(await ledger.status())));
app.get("/api/health", (_req, res) => res.json({ ok: true, mode: LEDGER_MODE }));

ledger.seed()
  .then(() => app.listen(PORT, () => console.log(`Nelva BE (${LEDGER_MODE}) on http://localhost:${PORT}  — seeded. GET /api/status`)))
  .catch((e) => { console.error("seed failed:", e); process.exit(1); });
