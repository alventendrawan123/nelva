// Real Canton adapter — talks to the JSON Ledger API v2 (e.g. dpm sandbox on 7575).
// Uses the JSON Ledger API recipe verified end-to-end on the dpm sandbox + 5N DevNet:
// POST /v2/parties (allocate, fallback lookup), submit-and-wait-for-transaction-tree
// (extract created cids), POST /v2/state/active-contracts (filtersByParty = per-party
// privacy). Privacy in the Lens is REAL here — each party-scoped read returns only
// that party's projected slice.
import type { Ledger } from "./ledger.js";
import { TIER_MULTIPLIER } from "./types.js";
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, Tier, HoldingView, Role } from "./types.js";
import { cheatMatch, type BidInput } from "./match.js";

const BASE = process.env.JSON_LEDGER_API ?? "http://localhost:7575";
// package id of the deployed DAR — UPDATE on every SC rebuild (dpm damlc inspect-dar --json)
// A Daml-LF package id is exactly 64 lowercase hex chars. A malformed env override (e.g. a
// copy-paste with a doubled digit -> 65 chars) makes EVERY command submission fail with
// "Daml-LF Package ID is too long". Reject anything that isn't a clean 64-hex string and fall
// back to the vetted, on-DevNet id so a bad env var can't brick the whole ledger adapter.
const ENV_PKG = process.env.NELVA_PACKAGE_ID?.trim();
const PKG = ENV_PKG && /^[0-9a-f]{64}$/.test(ENV_PKG)
  ? ENV_PKG
  : "27da556acd65944ceb385c82fa94c3a64551b9bb263ad4668eaa55e9ba8e21c9";
const USER = process.env.LEDGER_USER_ID ?? "nelva-be";
// On a SHARED validator (e.g. 5N DevNet sandbox) the participant namespace is shared, so a
// bare hint like "Operator" collides with another team's "Operator". A prefix scopes our
// parties. Empty (default) = sandbox behaviour unchanged. Set NELVA_PARTY_PREFIX=nelva- on 5N.
const PARTY_PREFIX = process.env.NELVA_PARTY_PREFIX ?? "";
const hintOf = (name: string) => PARTY_PREFIX + name;
const DEADLINE = "2030-01-01T00:00:00Z"; // default far-future maturity for loans/seeds
// A SealedBid's withdraw deadline = now + durationDays. Using the hardcoded far-future
// DEADLINE here made WithdrawBid impossible until 2030, locking lender funds.
const deadlineFrom = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const tid = (s: string) => `${PKG}:Nelva.${s}`;
// Template filters in the v2 ACS query must use the PACKAGE NAME (#name), not a package id
// ("expected a package name"). The package-name form resolves across upgrade versions, so the
// JS-side `=== tid(...)` check still narrows to the current package's contracts.
const tfilter = (s: string) => `#nelva-sc:Nelva.${s}`;
// Display/compare name = hint with the party prefix stripped, so "nelva-Borrower::ns" reads
// back as "Borrower" and matches a bare viewer name from dev-auth.
const nameOf = (pid: string) => {
  if (!pid) return pid;
  const n = pid.split("::")[0];
  return PARTY_PREFIX && n.startsWith(PARTY_PREFIX) ? n.slice(PARTY_PREFIX.length) : n;
};

// OAuth2 client_credentials token provider (cached). When AUTH_TOKEN_URL is
// unset (e.g. dpm sandbox) NO Authorization header is sent — backward compatible.
// On DevNet / LocalNet / NaaS, set AUTH_* and every Ledger API call is Bearer-authed.
let _tok: { value: string; exp: number } | null = null;
// The command-submitting userId. On an auth participant this MUST be the token's user
// (its `sub`), not our app name — the participant rejects a mismatched userId. Decoded
// from the JWT when a token is fetched; falls back to LEDGER_USER_ID/nelva-be on sandbox.
let _userId: string | null = null;
const ledgerUserId = (): string => _userId ?? USER;
async function authHeader(): Promise<Record<string, string>> {
  const url = process.env.AUTH_TOKEN_URL;
  if (!url) return {}; // sandbox: auth disabled
  const now = Date.now();
  if (_tok && now < _tok.exp - 60_000) return { Authorization: `Bearer ${_tok.value}` };
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AUTH_CLIENT_ID ?? "",
    client_secret: process.env.AUTH_CLIENT_SECRET ?? "",
    scope: process.env.AUTH_SCOPE ?? "daml_ledger_api",
  });
  if (process.env.AUTH_AUDIENCE) form.set("audience", process.env.AUTH_AUDIENCE);
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const txt = await r.text();
  if (!r.ok) throw new Error(`auth token fetch -> ${r.status} ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  _tok = { value: j.access_token, exp: now + Number(j.expires_in ?? 300) * 1000 };
  try { _userId = JSON.parse(Buffer.from(String(j.access_token).split(".")[1], "base64url").toString()).sub ?? _userId; } catch { /* opaque token: keep fallback */ }
  return { Authorization: `Bearer ${_tok.value}` };
}

// Build an Error that carries the ledger HTTP status + Canton error code so the BE's
// h() wrapper can classify (and sanitize) it instead of leaking raw ids to the client.
function ledgerError(path: string, status: number, txt: string): Error {
  const code = /"code":"([A-Z_]+)"/.exec(txt)?.[1];
  const e: any = new Error(`${path} -> ${status} ${txt.slice(0, 300)}`);
  e.ledger = true; e.status = status; e.code = code;
  return e;
}
async function post(path: string, body: any): Promise<any> {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) });
  const txt = await r.text();
  if (r.status === 401) { _tok = null; } // force refresh next call
  if (!r.ok) throw ledgerError(path, r.status, txt);
  return txt ? JSON.parse(txt) : {};
}
async function get(path: string): Promise<any> {
  const r = await fetch(BASE + path, { headers: { ...(await authHeader()) } });
  if (r.status === 401) { _tok = null; }
  if (!r.ok) throw ledgerError(path, r.status, await r.text().catch(() => ""));
  return r.json();
}

type CW = { cid: string; arg: any }; // contract wrapper

export class CantonLedger implements Ledger {
  private parties = new Map<string, string>();
  private seq = 0;
  private nid(p: string) { return `${p}-${Date.now().toString(36)}-${++this.seq}`; }

  // Parties whose CanActAs we've already granted to the token user this process — dedup only
  // (the grant itself persists on the participant, so a restart with an empty set is harmless).
  private granted = new Set<string>();
  // On an auth participant, allocating a party does NOT grant the submitting user rights over
  // it — a later actAs then 403s. Grant CanActAs (which subsumes read) once per party. No-op on
  // sandbox (no AUTH_TOKEN_URL → no user-rights model).
  private async grantActAs(pid: string): Promise<void> {
    if (!process.env.AUTH_TOKEN_URL || this.granted.has(pid)) return;
    await authHeader(); // ensure the token (and _userId) is populated
    const uid = ledgerUserId();
    try {
      await post(`/v2/users/${encodeURIComponent(uid)}/rights`, { userId: uid, rights: [{ kind: { CanActAs: { value: { party: pid } } } }] });
    } catch (e) { /* already granted / racing alloc — the submit will surface a real auth failure */ }
    this.granted.add(pid);
  }

  private async ensureParty(name: string): Promise<string> {
    if (name.includes("::")) return name; // already a full party-id (e.g. an external wallet party) — use as-is
    const c = this.parties.get(name);
    if (c) return c;
    try {
      const r = await post("/v2/parties", { partyIdHint: hintOf(name) });
      const pid = r.partyDetails.party;
      this.parties.set(name, pid);
      await this.grantActAs(pid);
      return pid;
    } catch {
      const found = await this.lookupParty(name);
      if (found) { await this.grantActAs(found); return found; }
      throw new Error(`cannot allocate or find party ${name}`);
    }
  }

  // The participant's namespace fingerprint (the part after "::" in every party it hosts).
  // Derived once from the token user's primaryParty. Lets us resolve a party by CONSTRUCTING
  // its full id + a direct GET, instead of scanning /v2/parties — which on a shared validator
  // is paginated over tens of thousands of parties (our hint is never on page 1).
  private _ns: string | null = null;
  private async participantNamespace(): Promise<string | null> {
    if (this._ns) return this._ns;
    try {
      const u = await get(`/v2/users/${encodeURIComponent(ledgerUserId())}`);
      const pp: string | undefined = u?.user?.primaryParty;
      if (pp && pp.includes("::")) { this._ns = pp.split("::")[1]; return this._ns; }
    } catch { /* no user/primaryParty (e.g. sandbox) — fall back to list scan */ }
    return null;
  }

  // Read-only party resolution — NEVER allocates. Used by GET/read paths so an
  // unauthenticated read can't be turned into an unbounded party-allocation primitive.
  private async lookupParty(name: string): Promise<string | null> {
    if (!name) return null;
    if (name.includes("::")) return name;
    const c = this.parties.get(name);
    if (c) return c;
    // Preferred path: construct <hint>::<namespace> and resolve it directly (works even when
    // the party is deep in a paginated /v2/parties list on a busy shared validator).
    const ns = await this.participantNamespace();
    if (ns) {
      const pid = `${hintOf(name)}::${ns}`;
      try {
        const d = await get(`/v2/parties/${encodeURIComponent(pid)}`);
        const hit = (d.partyDetails ?? []).some((p: any) => (typeof p === "string" ? p : p.party) === pid);
        if (hit) { this.parties.set(name, pid); return pid; }
      } catch { /* not found by id — fall through to legacy scan */ }
    }
    // Legacy fallback (dpm sandbox / small ledger): scan the first page.
    const d = await get("/v2/parties");
    const list = d.partyDetails ?? d.parties ?? [];
    for (const pd of list) {
      const pid = typeof pd === "string" ? pd : pd.party;
      if (pid && pid.split("::")[0] === hintOf(name)) { this.parties.set(name, pid); return pid; }
    }
    return null;
  }
  // Invalidate the name->party-id cache (e.g. after a sandbox/participant restart makes
  // cached ids stale). Called on ledger auth errors so the next call re-resolves.
  private resetPartyCache() { this.parties.clear(); this._sync = null; this._ns = null; }

  private async submit(actAs: string[], command: any, readAs?: string[]) {
    await authHeader(); // populate _userId so the command's userId matches the token's user
    const body: any = { commands: [command], commandId: this.nid("c"), userId: ledgerUserId(), actAs };
    if (readAs) body.readAs = readAs;
    try {
      const r = await post("/v2/commands/submit-and-wait-for-transaction-tree", body);
      return r.transactionTree;
    } catch (e: any) {
      // stale name->party-id cache (e.g. sandbox restarted under a new namespace key)
      // surfaces as a party/authorization error — clear the cache so the next call re-resolves.
      if (e?.code === "DAML_AUTHORIZATION_ERROR" || e?.code === "PARTY_NOT_KNOWN_ON_LEDGER" || /unknown party|party .* not/i.test(String(e?.message ?? ""))) this.resetPartyCache();
      throw e;
    }
  }
  private create(actAs: string[], tmpl: string, args: any) {
    return this.submit(actAs, { CreateCommand: { templateId: tid(tmpl), createArguments: args } });
  }
  private exercise(actAs: string[], tmpl: string, cid: string, choice: string, arg: any, readAs?: string[]) {
    return this.submit(actAs, { ExerciseCommand: { templateId: tid(tmpl), contractId: cid, choice, choiceArgument: arg } }, readAs);
  }
  private made(tree: any, tmpl: string): CW {
    const all = this.allMade(tree, tmpl);
    if (!all.length) throw new Error(`no created ${tmpl} in transaction`);
    return all[0];
  }
  private allMade(tree: any, tmpl: string): CW[] {
    const out: CW[] = [];
    for (const ev of Object.values<any>(tree.eventsById ?? {})) {
      const v = ev.CreatedTreeEvent?.value;
      if (v && String(v.templateId).endsWith("Nelva." + tmpl)) out.push({ cid: v.contractId, arg: v.createArgument });
    }
    return out;
  }
  private async acsAs(party: string, tmpl: string): Promise<CW[]> {
    const end = (await get("/v2/state/ledger-end")).offset;
    // Filter to THIS package's template AT THE LEDGER (not in JS). The shared DevNet accumulates
    // so many contracts across teams + package versions that an unfiltered per-party ACS query
    // blows the JSON API's max-list-elements limit; a TemplateFilter keyed on the current package
    // id returns only this template's (this-package) contracts, which also excludes a previous
    // package's stale contracts after an upgrade (their templateId carries the old package id).
    const arr: any[] = await post("/v2/state/active-contracts", {
      activeAtOffset: end,
      eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId: tfilter(tmpl), includeCreatedEventBlob: false } } } }] } }, verbose: true },
    });
    const out: CW[] = [];
    for (const e of arr) {
      const ce = e?.contractEntry?.JsActiveContract?.createdEvent;
      if (ce && String(ce.templateId) === tid(tmpl)) out.push({ cid: ce.contractId, arg: ce.createArgument });
    }
    return out;
  }

  // ── mappers ──
  private bidDto(x: CW): Bid {
    const a = x.arg;
    return { bidId: a.bidId, cid: x.cid, lender: nameOf(a.lender), amount: Number(a.amount), rate: Number(a.bidRate), instrument: a.instrument, status: "OPEN", deadline: a.deadline };
  }
  private borrowDto(x: CW): BorrowIntent {
    const a = x.arg, tier = a.tier as Tier;
    const collateralAmount = Number(a.collateralAmount ?? 0);
    return { borrowId: a.borrowId, cid: x.cid, borrower: nameOf(a.borrower), amount: Number(a.amount), maxRate: Number(a.maxRate), tier, requiredCollateral: Number(a.amount) * TIER_MULTIPLIER[tier], collateralAmount, instrument: a.instrument, status: "OPEN" };
  }
  private ticksDto(ts: any[]) { return (ts ?? []).map((t) => ({ lender: nameOf(t.lender), bidId: t.bidId, amount: Number(t.amount), rate: Number(t.rate) })); }
  private propDto(x: CW): MatchProposal {
    const a = x.arg;
    return { proposalId: x.cid, borrowId: String(a.proposalId ?? "").replace(/^P-/, ""), borrower: nameOf(a.borrower), principal: Number(a.principal), blendedRate: Number(a.blendedRate), tier: a.tier as Tier, ticks: this.ticksDto(a.matchedTicks), inputBidIds: a.inputBidCids ?? [], status: "PENDING" };
  }
  private loanDto(x: CW): Loan {
    const a = x.arg;
    return { loanId: x.cid, borrower: nameOf(a.borrower), principal: Number(a.principal), blendedRate: Number(a.blendedRate), ticks: this.ticksDto(a.ticks), collateralAmount: Number(a.collateralAmount), tier: a.tier as Tier, maturity: a.maturity, status: "ACTIVE" };
  }
  private badgeDto(x: CW): AuditBadge {
    const a = x.arg, ok = a.verdict === true || a.verdict === "true";
    return { proposalId: a.proposalId, verdict: ok ? "GREEN" : "RED", reason: ok ? "recomputed match equals published" : "published match differs from deterministic recompute", auditor: nameOf(a.auditor), checkedAt: new Date().toISOString() };
  }

  // Serialize find-then-create per borrower within this BE process so two concurrent
  // borrows don't each create a CreditScore (the "single active per borrower" invariant
  // has no contract key to enforce it on-ledger).
  private _csLocks = new Map<string, Promise<string>>();
  private async ensureCreditScore(borrowerPid: string): Promise<string> {
    const inflight = this._csLocks.get(borrowerPid);
    if (inflight) return inflight;
    const job = (async () => {
      const op = await this.ensureParty("Operator");
      const existing = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === borrowerPid);
      if (existing) return existing.cid;
      // Int64 fields must be JSON strings in the v2 Ledger API (like Numeric) — sending
      // raw numbers is rejected by stricter Canton builds ("Expected ujson.Str").
      const tree = await this.create([op], "Credit:CreditScore", { operator: op, borrower: borrowerPid, tier: "Bronze", loansRepaid: "0", loansDefaulted: "0" });
      return this.made(tree, "Credit:CreditScore").cid;
    })();
    this._csLocks.set(borrowerPid, job);
    try { return await job; } finally { this._csLocks.delete(borrowerPid); }
  }

  // mint spare unlocked cash so a party's wallet shows available balance (not all locked)
  private async fund(party: string, amount: number, instrument = "USD") {
    const cust = await this.ensureParty("Custodian");
    const owner = await this.ensureParty(party);
    await this.create([cust], "Asset:Holding", { custodian: cust, owner, amount: String(amount), instrument, locker: null });
  }

  // ── lifecycle ──
  async seed() {
    const op = await this.ensureParty("Operator");
    await Promise.all(["Custodian", "Auditor", "LenderA", "LenderB", "Borrower", "Oracle"].map((n) => this.ensureParty(n)));
    if ((await this.acsAs(op, "Lending:SealedBid")).length > 0) return; // already seeded
    // seed a USD oracle price so liquidate/claim-excess (which now require a fresh, oracle-
    // bound price for their health checks) work without a manual admin/price call.
    await this.setPrice("USD", 1.0);
    await this.createBid("LenderA", { amount: 100, rate: 0.03 });
    await this.createBid("LenderB", { amount: 100, rate: 0.05 });
    await this.createBorrow("Borrower", { amount: 150, maxRate: 0.06, collateralAmount: 300 });
    // spare unlocked cash → wallet shows "available + locked", not 0
    await this.fund("LenderA", 50);
    await this.fund("LenderB", 50);
    await this.fund("Borrower", 100);
  }

  private async createBidRaw(party: string, p: { amount: number; rate: number; instrument?: string; durationDays?: number }): Promise<{ cid: string; arg: any }> {
    const lender = await this.ensureParty(party);
    const cust = await this.ensureParty("Custodian");
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const inst = p.instrument ?? "USD";
    const cash = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: lender, amount: String(p.amount), instrument: inst, locker: null }), "Asset:Holding");
    const locked = this.made(await this.exercise([lender], "Asset:Holding", cash.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([lender], "Lending:SealedBid", { lender, matchingOperator: op, auditor: aud, bidId: this.nid("bid"), holdingCid: locked.cid, amount: String(p.amount), bidRate: String(p.rate), instrument: inst, deadline: deadlineFrom(p.durationDays ?? 30) });
    return this.made(tree, "Lending:SealedBid");
  }
  async createBid(party: string, p: { amount: number; rate: number; instrument?: string; durationDays?: number }): Promise<Bid> {
    return this.bidDto(await this.createBidRaw(party, p));
  }
  async listBids(viewer?: string): Promise<Bid[]> {
    if (!viewer) return [];
    const v = await this.ensureParty(viewer);
    const op = await this.ensureParty("Operator");
    // A bid reserved in a pending proposal is still an active SealedBid on-ledger (it's only
    // archived at Accept), so tag it MATCHED here — otherwise the operator's auto-match is
    // invisible in the lender's "My sealed bids" list (every bid would read OPEN forever).
    const [bids, props] = await Promise.all([
      this.acsAs(v, "Lending:SealedBid"),
      this.acsAs(op, "Settlement:MatchProposal"),
    ]);
    const matched = new Set<string>(props.flatMap((p) => (p.arg.matchedTicks ?? []).map((t: any) => t.bidCid)));
    return bids.map((x) => ({ ...this.bidDto(x), status: matched.has(x.cid) ? "MATCHED" : "OPEN" }));
  }
  async withdrawBid(party: string, bidId: string): Promise<any> {
    const pid = await this.ensureParty(party);
    const bid = (await this.acsAs(pid, "Lending:SealedBid")).find((b) => b.arg.bidId === bidId);
    if (!bid) throw new Error("bid not found");
    await this.exercise([pid], "Lending:SealedBid", bid.cid, "WithdrawBid", {}); // SC-gated: only after deadline
    return { bidId, status: "WITHDRAWN" };
  }

  private async createBorrowRaw(party: string, p: { amount: number; maxRate: number; collateralAmount: number; instrument?: string }): Promise<{ cid: string; arg: any }> {
    const bor = await this.ensureParty(party);
    const cust = await this.ensureParty("Custodian");
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const inst = p.instrument ?? "USD";
    // tier-aware: read the borrower's REAL tier (auto-creates Bronze if none) and
    // enforce collateral sufficiency at intent time.
    const csCid = await this.ensureCreditScore(bor);
    const cs = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.cid === csCid);
    const tier = (cs?.arg.tier ?? "Bronze") as Tier;
    const required = p.amount * TIER_MULTIPLIER[tier];
    if (p.collateralAmount < required)
      throw new Error(`insufficient collateral: need ${required.toFixed(2)} for ${tier} (got ${p.collateralAmount})`);
    const coll = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: bor, amount: String(p.collateralAmount), instrument: inst, locker: null }), "Asset:Holding");
    const lc = this.made(await this.exercise([bor], "Asset:Holding", coll.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([bor], "Lending:BorrowIntent", { borrower: bor, matchingOperator: op, auditor: aud, borrowId: this.nid("borrow"), collateralCid: lc.cid, collateralAmount: String(p.collateralAmount), amount: String(p.amount), maxRate: String(p.maxRate), tier, instrument: inst, deadline: DEADLINE });
    return this.made(tree, "Lending:BorrowIntent");
  }
  async createBorrow(party: string, p: { amount: number; maxRate: number; collateralAmount: number; instrument?: string }): Promise<BorrowIntent> {
    const dto = this.borrowDto(await this.createBorrowRaw(party, p));
    dto.collateralAmount = p.collateralAmount;
    return dto;
  }
  async listBorrows(viewer?: string): Promise<BorrowIntent[]> {
    if (!viewer) return [];
    const v = await this.ensureParty(viewer);
    const op = await this.ensureParty("Operator");
    // Same as listBids: a borrow reserved in a pending proposal is still an active BorrowIntent
    // (archived only at Accept), so tag it MATCHED so the borrower sees the auto-match land.
    const [borrows, props] = await Promise.all([
      this.acsAs(v, "Lending:BorrowIntent"),
      this.acsAs(op, "Settlement:MatchProposal"),
    ]);
    const matched = new Set<string>(props.map((p) => p.arg.borrowCid));
    return borrows.map((x) => ({ ...this.borrowDto(x), status: matched.has(x.cid) ? "MATCHED" : "OPEN" }));
  }
  async listProposals(viewer?: string): Promise<MatchProposal[]> {
    if (!viewer) return [];
    const v = await this.ensureParty(viewer);
    const [props, borrows, bids] = await Promise.all([
      this.acsAs(v, "Settlement:MatchProposal"),
      this.acsAs(v, "Lending:BorrowIntent"),
      this.acsAs(v, "Lending:SealedBid"),
    ]);
    // Hide DEAD proposals — ones whose borrow or any input bid was already archived (e.g. a
    // leftover from a prior demo round). Verify (Settlement.daml) re-fetches borrowCid AND the
    // FULL inputBidCids set ("incl losers"), so a proposal is only verifiable if ALL of those
    // are still live — checking just matchedTicks misses a loser bid that later won+Accepted
    // elsewhere and got archived, which would still 409 Verify. Never surfacing dead proposals
    // keeps the Lens dropdown + its default selection on proposals that actually verify.
    const liveBorrows = new Set(borrows.map((b) => b.cid));
    const liveBids = new Set(bids.map((b) => b.cid)); // empty for a borrower (bids are sealed) -> bid check skipped
    const alive = props.filter((p) => {
      if (!liveBorrows.has(p.arg.borrowCid)) return false;
      if (liveBids.size > 0 && !(p.arg.inputBidCids ?? []).every((c: string) => liveBids.has(c))) return false;
      return true;
    });
    return alive.map((x) => this.propDto(x));
  }
  async accept(party: string, proposalId: string): Promise<Loan> {
    const bor = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const tree = await this.exercise([bor], "Settlement:MatchProposal", proposalId, "Accept", {}, [op]);
    return this.loanDto(this.made(tree, "Settlement:Loan"));
  }
  async reject(party: string, proposalId: string): Promise<any> {
    const bor = await this.ensureParty(party);
    await this.exercise([bor], "Settlement:MatchProposal", proposalId, "Reject", {});
    return { proposalId, status: "REJECTED" };
  }
  async listLoans(viewer?: string): Promise<Loan[]> {
    if (!viewer) return [];
    return (await this.acsAs(await this.ensureParty(viewer), "Settlement:Loan")).map((x) => this.loanDto(x));
  }
  async repay(party: string, loanId: string): Promise<any> {
    const bor = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const cust = await this.ensureParty("Custodian");
    const loan = (await this.acsAs(bor, "Settlement:Loan")).find((l) => l.cid === loanId);
    if (!loan) throw new Error("loan not found");
    const ticks: any[] = loan.arg.ticks ?? [];
    const owed = ticks.reduce((a, t) => a + Number(t.amount) + Number(t.amount) * Number(t.rate), 0);
    const repayHolding = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: bor, amount: String(owed + 1), instrument: "USD", locker: null }), "Asset:Holding");
    const cs = await this.ensureCreditScore(bor);
    const positions = (await this.acsAs(op, "Settlement:LoanPosition")).filter((x) => x.arg.loanKey === loan.arg.loanKey);
    await this.exercise([bor], "Settlement:Loan", loanId, "Repay", { repaymentCid: repayHolding.cid, creditScoreCid: cs, positionCids: positions.map((x) => x.cid) }, [op]);
    const csNow = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === bor);
    return { loanId, status: "REPAID", newTier: csNow?.arg.tier ?? "Silver" };
  }

  private _matching = false;
  // allowSelfHeal: the MANUAL "Run Match" button (true) may mint a fresh isolated pair when the
  // book is starved, so a judge always gets a verifiable proposal. The background auto-matcher
  // passes false — it must only settle REAL open demand, never fabricate persona bids/borrows
  // every tick (which would pile up junk proposals forever).
  async runMatch(allowSelfHeal = true): Promise<MatchProposal[]> {
    // mutex: a slow (>20s) tick must not overlap the interval or a manual run-match, or
    // both rounds fetch/propose the same free bids -> duplicate proposals / races.
    if (this._matching) return [];
    this._matching = true;
    try {
      const op = await this.ensureParty("Operator");
      const aud = await this.ensureParty("Auditor");
      const bids = await this.acsAs(op, "Lending:SealedBid");
      const borrows = await this.acsAs(op, "Lending:BorrowIntent");
      // Skip bids/borrows already committed to a PENDING proposal — they're only
      // consumed at Accept, so without this the auto-matcher re-matches the same
      // ones every tick and proposals pile up.
      const proposals = await this.acsAs(op, "Settlement:MatchProposal");
      const usedBids = new Set<string>(proposals.flatMap((p) => (p.arg.matchedTicks ?? []).map((t: any) => t.bidCid)));
      const usedBorrows = new Set<string>(proposals.map((p) => p.arg.borrowCid));
      // Defense-in-depth against a zombie BorrowIntent whose collateral Holding was already
      // archived (e.g. a legacy Reject before the SC fix): RunMatch fetches bi.collateralCid,
      // so one dangling ref aborts the WHOLE round. Only match borrows whose collateral is live.
      const liveHoldings = new Set<string>((await this.acsAs(op, "Asset:Holding")).map((hd) => hd.cid));
      let freeBids = bids.filter((b) => !usedBids.has(b.cid));
      let freeBorrows = borrows.filter((b) => !usedBorrows.has(b.cid) && liveHoldings.has(b.arg.collateralCid));
      // Demo self-heal: the shared DevNet book can reach a state where every open bid is
      // already reserved by a PENDING proposal (bids only release at Accept/Reject), which
      // would starve the operator match forever and leave "Run Match" returning nothing. In
      // that case mint a fresh, isolated honest lender-pair + borrower and match exactly
      // those — so Run Match always yields a real, verifiable proposal through the SAME
      // on-ledger RunMatch choice + auditor Verify (not a mock; genuine on-ledger contracts).
      if (allowSelfHeal && (!freeBids.length || !freeBorrows.length)) {
        await this.setPrice("USD", 1.0);
        // Mint ONLY the starved side and KEEP the live side, so a real bid/borrow a tester just
        // posted is matched against the minted counterpart instead of being thrown away. (An
        // earlier version overwrote both sides, silently dropping a tester's live borrow.)
        if (!freeBids.length) {
          freeBids = [
            await this.createBidRaw("LenderA", { amount: 100, rate: 0.03 }),
            await this.createBidRaw("LenderB", { amount: 100, rate: 0.05 }),
          ];
        }
        if (!freeBorrows.length) {
          freeBorrows = [await this.createBorrowRaw("Borrower", { amount: 150, maxRate: 0.06, collateralAmount: 300 })];
        }
      }
      // No real (or minted) pair to match -> nothing to do. Bail before creating a MatchRound so
      // the 20s auto-matcher doesn't churn empty rounds every tick.
      if (!freeBids.length || !freeBorrows.length) return [];
      // RunMatch validates each borrow's declared tier against an operator-signed CreditScore
      // and SILENTLY drops any borrow without one. Wallet borrowers don't otherwise get a score
      // that survives to match time, so their intents could never be matched. Ensure a score
      // exists for every free borrow's borrower first, then pass all scores so honest borrows
      // (tier == score) match. (Bronze default == the tier a fresh borrow declares.)
      await Promise.all([...new Set(freeBorrows.map((b) => b.arg.borrower as string))].map((p) => this.ensureCreditScore(p)));
      const scores = await this.acsAs(op, "Credit:CreditScore");
      const oracle = await this.ensureParty("Oracle");
      const rnd = this.made(await this.create([op], "Settlement:MatchRound", { operator: op, auditor: aud }), "Settlement:MatchRound");
      const tree = await this.exercise([op], "Settlement:MatchRound", rnd.cid, "RunMatch", { bidCids: freeBids.map((b) => b.cid), borrowCids: freeBorrows.map((b) => b.cid), creditScoreCids: scores.map((s) => s.cid), oracle });
      return this.allMade(tree, "Settlement:MatchProposal").map((x) => this.propDto(x));
    } finally {
      this._matching = false;
    }
  }
  async runCheatMatch(): Promise<MatchProposal[]> {
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const cust = await this.ensureParty("Custodian");
    const oracle = await this.ensureParty("Oracle");
    const bids = await this.acsAs(op, "Lending:SealedBid");
    const borrows = await this.acsAs(op, "Lending:BorrowIntent");
    if (!bids.length || !borrows.length) return [];
    const b = borrows[0], ba = b.arg;
    const bidInputs: (BidInput & { cid: string })[] = bids.map((x) => ({ bidId: x.arg.bidId, lender: x.arg.lender, amount: Number(x.arg.amount), rate: Number(x.arg.bidRate), cid: x.cid }));
    const fills = cheatMatch(bidInputs, [{ borrowId: ba.borrowId, borrower: ba.borrower, amount: Number(ba.amount), maxRate: Number(ba.maxRate) }]);
    const f = fills[0];
    if (!f) return [];
    const cidByBidId = new Map(bidInputs.map((x) => [x.bidId, x.cid]));
    const ticks = f.ticks.map((t) => ({ lender: t.lender, bidId: t.bidId, bidCid: cidByBidId.get(t.bidId), amount: String(t.amount), rate: String(t.rate) }));
    // The cheat proposal's escrow must be LOCKED like a real one, else Accept (DrawLocked)
    // and Reject (DrawLockedAmount) both abort (they assert locker /= None) and the proposal
    // becomes un-consumable, permanently reserving its bids/borrow. Own it to the operator
    // and lock to the operator so both choices resolve.
    const dummyUnlocked = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: op, amount: "1.0", instrument: "USD", locker: null }), "Asset:Holding");
    const dummy = this.made(await this.exercise([op], "Asset:Holding", dummyUnlocked.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([op], "Settlement:MatchProposal", {
      operator: op, borrower: ba.borrower, auditor: aud, lenders: f.ticks.map((t) => t.lender),
      proposalId: "P-CHEAT", principal: String(f.principal), blendedRate: String(f.blendedRate), tier: ba.tier,
      matchedTicks: ticks, inputBidCids: bids.map((x) => x.cid),
      roundBorrows: [{ borrowId: ba.borrowId, borrower: ba.borrower, amount: String(ba.amount), maxRate: String(ba.maxRate) }],
      borrowCid: b.cid,
      collateralCid: dummy.cid, collateralAmount: "1.0", requiredCollateral: "0.0", oracle, instrument: "USD", maturity: DEADLINE,
    });
    return [this.propDto(this.made(tree, "Settlement:MatchProposal"))];
  }
  async setPrice(instrument: string, price: number): Promise<any> {
    const oracle = await this.ensureParty("Oracle");
    const op = await this.ensureParty("Operator");
    await this.create([oracle], "Settlement:PriceUpdate", { oracle, operator: op, instrument, price: String(price), asOf: new Date().toISOString() });
    return { instrument, price };
  }
  async liquidate(loanId: string): Promise<any> {
    const op = await this.ensureParty("Operator");
    const loan = (await this.acsAs(op, "Settlement:Loan")).find((l) => l.cid === loanId);
    if (!loan) throw new Error("loan not found");
    const inst = loan.arg.instrument ?? "USD";
    // use the NEWEST PriceUpdate (setPrice appends, never archives); .find() picked the
    // oldest and mis-decided liquidations. latestPrice reduces by asOf.
    const price = await this.latestPrice(inst);
    const cs = await this.ensureCreditScore(loan.arg.borrower);
    const positions = (await this.acsAs(op, "Settlement:LoanPosition")).filter((x) => x.arg.loanKey === loan.arg.loanKey);
    await this.exercise([op], "Settlement:Loan", loanId, "Liquidate", { priceCid: price.cid, creditScoreCid: cs, positionCids: positions.map((x) => x.cid) });
    return { loanId, status: "LIQUIDATED" };
  }

  async auditBids(): Promise<Bid[]> {
    return (await this.acsAs(await this.ensureParty("Auditor"), "Lending:SealedBid")).map((x) => this.bidDto(x));
  }
  async verify(auditor: string, proposalId: string): Promise<AuditBadge> {
    const aud = await this.ensureParty(auditor || "Auditor");
    const vr = this.made(await this.create([aud], "Settlement:VerifyRequest", { auditor: aud }), "Settlement:VerifyRequest");
    const tree = await this.exercise([aud], "Settlement:VerifyRequest", vr.cid, "Verify", { proposalCid: proposalId });
    return this.badgeDto(this.made(tree, "Settlement:AuditBadge"));
  }
  async listBadges(): Promise<AuditBadge[]> {
    return (await this.acsAs(await this.ensureParty("Auditor"), "Settlement:AuditBadge")).map((x) => this.badgeDto(x));
  }

  // Perspective is SCOPED to the caller. The operator/auditor projection (every sealed
  // rate) is served only to an operator/auditor Bearer; a borrower/lender sees only their
  // own slice; an anonymous/outsider caller gets the status view only. This is what makes
  // the sealed-bid privacy hold at the API boundary (not just in the Daml projection).
  async lens(proposalId: string, viewer?: string, role?: Role) {
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const privileged = role === "operator" || role === "auditor";
    const props = await this.acsAs(op, "Settlement:MatchProposal");
    const p = props.find((x) => x.cid === proposalId) ?? props[0] ?? null;
    const parg = p?.arg;
    const subject = parg ? { proposalId, borrower: nameOf(parg.borrower), principal: Number(parg.principal) } : null;
    const outsider = { canSee: ["status"], status: await this.status() };

    // Operator/Auditor are trusted to see everything (they already can via their ACS), so
    // they get the FULL teaching view — all five perspectives side by side. This restores
    // the hero Lens demo WITHOUT re-opening the anonymous leak (anon still gets outsider-only).
    if (privileged) {
      const allBids = await this.acsAs(op, "Lending:SealedBid");
      const exLender: string | undefined = parg?.matchedTicks?.[0]?.lender;
      const lenderBids = exLender ? await this.acsAs(exLender, "Lending:SealedBid") : [];
      const badges = await this.acsAs(aud, "Settlement:AuditBadge");
      const mine = badges.filter((x) => x.arg.proposalId === parg?.proposalId);
      const badge = mine.length ? mine[mine.length - 1] : null;
      return {
        subject,
        perspectives: {
          lender: { party: exLender ? nameOf(exLender) : null, canSee: ["ownBid"], bids: lenderBids.map((x) => this.bidDto(x)) },
          borrower: { party: parg ? nameOf(parg.borrower) : null, canSee: ["proposal"], proposal: p ? this.propDto(p) : null },
          operator: { canSee: ["allBids", "proposal"], bids: allBids.map((x) => this.bidDto(x)), proposal: p ? this.propDto(p) : null },
          auditor: { canSee: ["allBids", "verdict"], bids: allBids.map((x) => this.bidDto(x)), badge: badge ? this.badgeDto(badge) : null },
          outsider,
        },
      };
    }

    // Non-privileged callers only ever get their own slice (never rivals' rates).
    const perspectives: any = { outsider };
    const isOwnerBorrower = !!(viewer && parg && nameOf(parg.borrower) === viewer);
    if (isOwnerBorrower) {
      perspectives.borrower = { party: viewer, canSee: ["proposal"], proposal: p ? this.propDto(p) : null };
    }
    if (viewer && role === "lender") {
      const own = await this.acsAs(await this.ensureParty(viewer), "Lending:SealedBid");
      perspectives.lender = { party: viewer, canSee: ["ownBid"], bids: own.map((x) => this.bidDto(x)) };
    }
    return { subject: isOwnerBorrower ? subject : null, perspectives };
  }

  async status() {
    const op = await this.ensureParty("Operator");
    const [bids, loans, props] = await Promise.all([
      this.acsAs(op, "Lending:SealedBid"),
      this.acsAs(op, "Settlement:Loan"),
      this.acsAs(op, "Settlement:MatchProposal"),
    ]);
    return { openBids: bids.length, activeLoans: loans.length, proposals: props.length, lastMatchAt: props.length ? new Date().toISOString() : null };
  }

  // real wallet: the party's own Holding contracts on Canton
  async holdings(viewer?: string): Promise<HoldingView[]> {
    if (!viewer) return [];
    const pid = await this.lookupParty(viewer);
    if (!pid) return [];
    const hs = await this.acsAs(pid, "Asset:Holding");
    return hs
      .filter((x) => x.arg.owner === pid)
      .map((x) => ({ instrument: x.arg.instrument, amount: Number(x.arg.amount), locked: x.arg.locker != null }));
  }
  async partyId(name: string): Promise<string | null> {
    if (!name) return null;
    return this.ensureParty(name);
  }

  // Is this party actually allocated on the CURRENT ledger? A wallet party from a
  // previous deploy/network (e.g. a pre-DevNet sandbox onboard, still in the browser's
  // localStorage) is a "zombie": it looks connected but every write fails with
  // UNKNOWN_INFORMEES because the participant doesn't know it. The FE calls this on
  // re-attach to detect a zombie and re-onboard fresh instead of getting stuck.
  async partyKnown(party: string): Promise<boolean> {
    if (!party) return false;
    if (!party.includes("::")) return !!(await this.lookupParty(party)); // persona hint
    try {
      const d = await get(`/v2/parties/${encodeURIComponent(party)}`);
      const list = d.partyDetails ?? [];
      return list.some((p: any) => (typeof p === "string" ? p : p.party) === party);
    } catch {
      return false;
    }
  }

  // ── external-party wallet relay (BE never holds the user's key) ──
  private _sync: string | null = null;
  private async synchronizerId(): Promise<string> {
    if (this._sync) return this._sync;
    const r = await get("/v2/state/connected-synchronizers");
    this._sync = r.connectedSynchronizers?.[0]?.synchronizerId;
    if (!this._sync) throw new Error("no connected synchronizer");
    return this._sync;
  }
  // mint starter cash for a freshly-onboarded external party (custodian-signed; owner = the external party)
  private async fundPid(ownerPid: string, amount: number, instrument = "USD") {
    const cust = await this.ensureParty("Custodian");
    await this.create([cust], "Asset:Holding", { custodian: cust, owner: ownerPid, amount: String(amount), instrument, locker: null });
  }

  // step 1: FE sends its public key -> we ask the node to build the onboarding topology + return the hash to sign
  async walletOnboard(partyHint: string, publicKeyB64: string) {
    const synchronizer = await this.synchronizerId();
    const r = await post("/v2/parties/external/generate-topology", {
      synchronizer,
      partyHint,
      publicKey: { format: "CRYPTO_KEY_FORMAT_DER_X509_SUBJECT_PUBLIC_KEY_INFO", keyData: publicKeyB64, keySpec: "SIGNING_KEY_SPEC_EC_CURVE25519" },
      otherConfirmingParticipantUids: [],
    });
    return { partyId: r.partyId, multiHash: r.multiHash, fingerprint: r.publicKeyFingerprint, topologyTransactions: r.topologyTransactions };
  }
  // step 2: FE signs the multiHash locally and returns it -> we finalize allocation + fund the new party
  async walletAllocate(topologyTransactions: any[], fingerprint: string, multiHashSig: string) {
    const synchronizer = await this.synchronizerId();
    const r = await post("/v2/parties/external/allocate", {
      synchronizer,
      onboardingTransactions: topologyTransactions.map((t) => ({ transaction: t })),
      multiHashSignatures: [{ format: "SIGNATURE_FORMAT_CONCAT", signature: multiHashSig, signedBy: fingerprint, signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519" }],
      identityProviderId: "",
    });
    if (r.partyId) { try { await this.fundPid(r.partyId, 200); } catch (e) { console.warn("fund failed", e); } }
    return r;
  }
  // step 3: build a transaction for the user's commands -> return the hash for the FE to sign. actAs is forced to the wallet party.
  async walletPrepare(party: string, commands: any[], disclosedContracts: any[] = []) {
    const synchronizerId = await this.synchronizerId();
    const r = await post("/v2/interactive-submission/prepare", {
      userId: ledgerUserId(), commandId: this.nid("wc"), actAs: [party], synchronizerId,
      commands, packageIdSelectionPreference: [], verboseHashing: true,
      disclosedContracts,
    });
    return { preparedTransaction: r.preparedTransaction, preparedTransactionHash: r.preparedTransactionHash, hashingSchemeVersion: r.hashingSchemeVersion };
  }

  // ACS (operator view) WITH createdEventBlob — needed to build disclosed contracts.
  // Fetch created-event blobs for disclosure. Filter to the specific templates the caller needs
  // (with includeCreatedEventBlob) rather than a wildcard: a wildcard over the operator's whole
  // ACS on the shared DevNet exceeds the JSON API's max-list-elements limit. Keyed on the current
  // package id, so only this-package contracts of those templates come back.
  private async acsWithBlobs(party: string, tmpls: string[]): Promise<Map<string, { templateId: string; arg: any; blob: string }>> {
    const end = (await get("/v2/state/ledger-end")).offset;
    const cumulative = tmpls.map((t) => ({ identifierFilter: { TemplateFilter: { value: { templateId: tfilter(t), includeCreatedEventBlob: true } } } }));
    const arr: any[] = await post("/v2/state/active-contracts", {
      activeAtOffset: end,
      eventFormat: { filtersByParty: { [party]: { cumulative } }, verbose: true },
    });
    const m = new Map<string, { templateId: string; arg: any; blob: string }>();
    for (const e of arr) {
      const ce = e?.contractEntry?.JsActiveContract?.createdEvent;
      if (ce?.contractId) m.set(ce.contractId, { templateId: ce.templateId, arg: ce.createArgument, blob: ce.createdEventBlob });
    }
    return m;
  }
  // disclosed contracts a wallet borrower needs to Accept a proposal: the matched
  // SealedBids + each bid's locked Holding (not visible to the borrower otherwise).
  async walletAcceptInfo(proposalCid: string) {
    const sync = await this.synchronizerId();
    const op = await this.ensureParty("Operator");
    const blobs = await this.acsWithBlobs(op, ["Settlement:MatchProposal", "Lending:SealedBid", "Asset:Holding"]);
    const prop = blobs.get(proposalCid);
    if (!prop) throw new Error("proposal not found");
    const cids = new Set<string>();
    for (const t of prop.arg.matchedTicks ?? []) {
      cids.add(t.bidCid);
      const bid = blobs.get(t.bidCid);
      if (bid?.arg?.holdingCid) cids.add(bid.arg.holdingCid);
    }
    const disclosed = [...cids].map((cid) => {
      const c = blobs.get(cid);
      if (!c) throw new Error(`referenced contract ${cid} not found`);
      return { templateId: c.templateId, contractId: cid, createdEventBlob: c.blob, synchronizerId: sync };
    });
    return { proposalCid, disclosed };
  }
  // info a wallet borrower needs to Repay: total `owed` (principal + per-lender
  // interest) + the operator-signed CreditScore to BumpUp (disclosed, since it's
  // freshly created). The borrower pays from their OWN unlocked holding (> owed),
  // not a minted one — that's the production path.
  async walletRepayInfo(party: string, loanId: string) {
    const sync = await this.synchronizerId();
    const bor = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const loan = (await this.acsAs(bor, "Settlement:Loan")).find((l) => l.cid === loanId);
    if (!loan) throw new Error("loan not found");
    const ticks: any[] = loan.arg.ticks ?? [];
    const owed = ticks.reduce((a, t) => a + Number(t.amount) + Number(t.amount) * Number(t.rate), 0);
    const creditScoreCid = await this.ensureCreditScore(bor);
    // Repay pays principal+interest to each lender and RETIRES their LoanPosition receipts, which
    // it takes as `positionCids`. LoanPositions are observed only by the lender (borrower is not a
    // stakeholder), so the wallet borrower can't see them — fetch by loanKey and disclose them.
    const positions = (await this.acsAs(op, "Settlement:LoanPosition")).filter((x) => x.arg.loanKey === loan.arg.loanKey);
    const positionCids = positions.map((x) => x.cid);
    const blobs = await this.acsWithBlobs(op, ["Credit:CreditScore", "Asset:Holding", "Settlement:LoanPosition"]);
    // the borrower can't see the CreditScore until it lands in its ACS, never sees the collateral
    // escrow (DrawLocked to the operator at Accept), and never sees the per-lender LoanPositions —
    // all must be disclosed for the wallet's prepare.
    const disclosed = [creditScoreCid, loan.arg.collateralCid, ...positionCids]
      .map((cid) => {
        const c = blobs.get(cid);
        return c ? { templateId: c.templateId, contractId: cid, createdEventBlob: c.blob, synchronizerId: sync } : null;
      })
      .filter(Boolean);
    return { loanId, owed, creditScoreCid, positionCids, disclosed };
  }
  // Top-up faucet: mint one 1000 nUSD Holding to the wallet party on every call, so a user who
  // has locked/spent their funds (collateral, sealed bids) can refill and keep exploring.
  // Minting as a SINGLE holding (not many small chunks) matters: a wallet borrow collateralizes
  // from ONE unlocked Holding (the Asset template has no Merge choice), so a fragmented balance
  // of small chunks can't back a large collateral. One 1000 chunk backs a borrow up to ~500.
  // nUSD is test money on DevNet — draining is harmless, so no once-only cap.
  private _faucetLocks = new Map<string, Promise<{ party: string; funded: boolean }>>();
  async walletFaucet(party: string) {
    if (!party) throw new Error("party required");
    const pid = await this.ensureParty(party);
    // serialize per party so a rapid double-click mints once, not twice
    const inflight = this._faucetLocks.get(pid);
    if (inflight) return inflight;
    const job = (async () => {
      await this.fundPid(pid, 1000);
      return { party: pid, funded: true };
    })();
    this._faucetLocks.set(pid, job);
    try { return await job; } finally { this._faucetLocks.delete(pid); }
  }
  // step 4: FE returns the signature over the prepared hash -> we submit. The key never left the browser.
  async walletExecute(party: string, preparedTransaction: string, hashingSchemeVersion: string, fingerprint: string, sig: string) {
    return post("/v2/interactive-submission/execute", {
      preparedTransaction, hashingSchemeVersion, userId: ledgerUserId(), submissionId: this.nid("we"),
      deduplicationPeriod: { Empty: {} },
      partySignatures: { signatures: [{ party, signatures: [{ format: "SIGNATURE_FORMAT_CONCAT", signature: sig, signedBy: fingerprint, signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519" }] }] },
    });
  }

  // package id + node-hosted party ids, so the FE can build Daml commands for wallet signing
  async config() {
    const [operator, auditor, custodian] = await Promise.all([
      this.ensureParty("Operator"),
      this.ensureParty("Auditor"),
      this.ensureParty("Custodian"),
    ]);
    return { packageId: PKG, parties: { operator, auditor, custodian } };
  }
  // a party's Holding contracts WITH contract ids (the FE needs cids to lock/split/bid)
  async walletHoldings(party: string) {
    if (!party) return [];
    const pid = await this.lookupParty(party);
    if (!pid) return [];
    const hs = await this.acsAs(pid, "Asset:Holding");
    return hs
      .filter((x) => x.arg.owner === pid)
      .map((x) => ({ cid: x.cid, amount: Number(x.arg.amount), instrument: x.arg.instrument, locked: x.arg.locker != null }));
  }

  // ══ extended additions ══

  // cancel-borrow / claim-excess (SC-backed)
  async cancelBorrow(party: string, borrowId: string): Promise<any> {
    const bor = await this.ensureParty(party);
    const bi = (await this.acsAs(bor, "Lending:BorrowIntent")).find((b) => b.arg.borrowId === borrowId);
    if (!bi) throw new Error("borrow not found");
    // Cancel is controller=borrower, touches only the borrower-owned locked Holding.
    await this.exercise([bor], "Lending:BorrowIntent", bi.cid, "Cancel", {});
    return { borrowId, status: "CANCELLED" };
  }
  async claimExcess(party: string, loanId: string): Promise<any> {
    const bor = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const loan = (await this.acsAs(bor, "Settlement:Loan")).find((l) => l.cid === loanId);
    if (!loan) throw new Error("loan not found");
    const collateralAmount = Number(loan.arg.collateralAmount);
    const requiredCollateral = Number(loan.arg.requiredCollateral);
    const excess = collateralAmount - requiredCollateral;
    if (!(excess > 0)) throw new Error("no excess collateral to claim");
    // ClaimExcess now requires a fresh, oracle-bound price and re-checks post-withdrawal
    // health, so a borrower can't strip collateral just before liquidation.
    const inst = loan.arg.instrument ?? "USD";
    const price = await this.latestPrice(inst);
    // ClaimExcess (controller=borrower) Splits+Transfers the OPERATOR-owned escrow;
    // readAs=[op] so the borrower's submission can resolve loan.collateralCid + the price (as accept/repay do).
    const tree = await this.exercise([bor], "Settlement:Loan", loanId, "ClaimExcess", { priceCid: price.cid }, [op]);
    const newLoan = this.loanDto(this.made(tree, "Settlement:Loan"));
    return { loanId: newLoan.loanId, excessReturned: excess, remainingCollateral: requiredCollateral };
  }
  // Info a WALLET borrower needs to sign ClaimExcess itself: the oracle price cid to pass, and
  // the disclosed blobs for the price (oracle-signed) + the operator-owned collateral escrow —
  // neither is in the borrower's ACS, so the wallet's prepare can't resolve them without these.
  async walletClaimExcessInfo(party: string, loanId: string) {
    const sync = await this.synchronizerId();
    const bor = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const loan = (await this.acsAs(bor, "Settlement:Loan")).find((l) => l.cid === loanId);
    if (!loan) throw new Error("loan not found");
    const excess = Number(loan.arg.collateralAmount) - Number(loan.arg.requiredCollateral);
    if (!(excess > 0)) throw new Error("no excess collateral to claim");
    const price = await this.latestPrice(loan.arg.instrument ?? "USD");
    const blobs = await this.acsWithBlobs(op, ["Settlement:PriceUpdate", "Asset:Holding"]);
    const disclosed = [price.cid, loan.arg.collateralCid]
      .map((cid) => {
        const c = blobs.get(cid);
        return c ? { templateId: c.templateId, contractId: cid, createdEventBlob: c.blob, synchronizerId: sync } : null;
      })
      .filter(Boolean);
    return { loanId, excess, priceCid: price.cid, disclosed };
  }

  // swap
  private async latestPrice(instrument: string): Promise<{ cid: string; price: number }> {
    const op = await this.ensureParty("Operator");
    const all = (await this.acsAs(op, "Settlement:PriceUpdate")).filter((x) => x.arg.instrument === instrument);
    if (!all.length) throw new Error(`no price for ${instrument}; POST /api/admin/price first`);
    const latest = all.reduce((a, b) => (String(a.arg.asOf) >= String(b.arg.asOf) ? a : b));
    return { cid: latest.cid, price: Number(latest.arg.price) };
  }
  async swapQuote(p: { instrumentIn: string; instrumentOut: string; amountIn: number }) {
    const [pin, pout] = await Promise.all([this.latestPrice(p.instrumentIn), this.latestPrice(p.instrumentOut)]);
    const amountOut = (p.amountIn * pin.price) / pout.price;
    return { instrumentIn: p.instrumentIn, instrumentOut: p.instrumentOut, amountIn: p.amountIn, amountOut, priceIn: pin.price, priceOut: pout.price, rate: pin.price / pout.price };
  }
  private async ensureSwapPool(): Promise<string> {
    const op = await this.ensureParty("Operator");
    const cust = await this.ensureParty("Custodian");
    const existing = await this.acsAs(op, "Settlement:SwapPool");
    if (existing.length) return existing[0].cid;
    const tree = await this.create([op, cust], "Settlement:SwapPool", { operator: op, custodian: cust });
    return this.made(tree, "Settlement:SwapPool").cid;
  }
  async swap(party: string, p: { instrumentIn: string; instrumentOut: string; amountIn: number; minAmountOut?: number }) {
    const swapper = await this.ensureParty(party);
    const op = await this.ensureParty("Operator");
    const oracle = await this.ensureParty("Oracle");
    // Draw from the swapper's OWN unlocked balance of instrumentIn — NEVER mint (minting
    // the in-Holding was free value creation). Pick the smallest holding that covers
    // amountIn; split it to the exact amount so the remainder stays with the swapper.
    const owned = (await this.acsAs(swapper, "Asset:Holding"))
      .filter((x) => x.arg.owner === swapper && x.arg.instrument === p.instrumentIn && x.arg.locker == null && Number(x.arg.amount) >= p.amountIn)
      .sort((a, b) => Number(a.arg.amount) - Number(b.arg.amount));
    const src = owned[0];
    if (!src) { const e: any = new Error(`insufficient unlocked ${p.instrumentIn} balance to swap ${p.amountIn}`); e.status = 400; throw e; }
    let inCid = src.cid;
    if (Number(src.arg.amount) > p.amountIn) {
      const splitTree = await this.exercise([swapper], "Asset:Holding", src.cid, "Split", { splitAmount: String(p.amountIn) });
      const pieces = this.allMade(splitTree, "Asset:Holding");
      inCid = (pieces.find((x) => Number(x.arg.amount) === p.amountIn) ?? pieces[0]).cid;
    }
    const [pin, pout] = await Promise.all([this.latestPrice(p.instrumentIn), this.latestPrice(p.instrumentOut)]);
    const amountOut = (p.amountIn * pin.price) / pout.price;
    const minOut = p.minAmountOut ?? 0;
    const pool = await this.ensureSwapPool();
    // actAs=[swapper, operator] (both controllers); readAs=[oracle] so the PriceUpdate contracts are visible.
    const tree = await this.exercise([swapper, op], "Settlement:SwapPool", pool, "Swap", {
      swapper, inCid, instrumentOut: p.instrumentOut,
      priceInCid: pin.cid, priceOutCid: pout.cid, minAmountOut: String(minOut),
    }, [oracle]);
    const out = this.made(tree, "Asset:Holding");
    return { holdingCid: out.cid, amountOut, instrumentOut: p.instrumentOut };
  }

  // consolidated dashboards (pure ACS fan-out)
  // READ-ONLY: never creates a CreditScore (that was a write side-effect on a GET path).
  // A borrower with no score yet reads as the synthetic Bronze default.
  private async creditScoreView(borrowerPid: string): Promise<{ tier: Tier; loansRepaid: number; loansDefaulted: number; collateralMultiplier: number }> {
    const op = await this.ensureParty("Operator");
    const cs = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === borrowerPid);
    const tier = (cs?.arg.tier ?? "Bronze") as Tier;
    return { tier, loansRepaid: Number(cs?.arg.loansRepaid ?? 0), loansDefaulted: Number(cs?.arg.loansDefaulted ?? 0), collateralMultiplier: TIER_MULTIPLIER[tier] };
  }
  async lenderStatus(party: string): Promise<any> {
    const pid = await this.lookupParty(party);
    if (!pid) return { party, activeLends: [], activeLoans: [], completedLoans: [], pendingPayouts: [] };
    const name = nameOf(pid);
    const activeLends = (await this.acsAs(pid, "Lending:SealedBid")).map((x) => this.bidDto(x));
    // Active loans come from the lender's PRIVATE LoanPosition receipts — the lender no
    // longer observes the shared Loan (which would expose rival co-funders' rates).
    const positions = (await this.acsAs(pid, "Settlement:LoanPosition")).filter((x) => x.arg.lender === pid);
    const activeLoans = positions.map((x) => {
      const amount = Number(x.arg.amount), rate = Number(x.arg.rate);
      const owedToMe = amount + amount * rate;
      return { loanId: x.arg.loanKey, borrower: nameOf(x.arg.borrower), maturity: x.arg.maturity, myPrincipal: amount, myRate: rate, owedToMe };
    });
    const completedLoans: any[] = [];
    const pendingPayouts = activeLoans.map((l) => ({ loanId: l.loanId, borrower: l.borrower, amount: l.owedToMe, maturity: l.maturity }));
    return { party: name, activeLends, activeLoans, completedLoans, pendingPayouts };
  }
  async borrowerStatus(party: string): Promise<any> {
    const pid = await this.lookupParty(party);
    if (!pid) return { party, pendingIntents: [], pendingProposals: [], activeLoans: [], completedLoans: [], creditScore: { tier: "Bronze", loansRepaid: 0, loansDefaulted: 0, collateralMultiplier: TIER_MULTIPLIER.Bronze } };
    const name = nameOf(pid);
    const [intents, proposals, loans, creditScore] = await Promise.all([
      this.acsAs(pid, "Lending:BorrowIntent"),
      this.acsAs(pid, "Settlement:MatchProposal"),
      this.acsAs(pid, "Settlement:Loan"),
      this.creditScoreView(pid),
    ]);
    const pendingIntents = intents.map((x) => this.borrowDto(x));
    const pendingProposals = proposals.map((x) => this.propDto(x));
    const activeLoans = loans.map((x) => this.loanDto(x)).filter((l) => l.borrower === name);
    const completedLoans: any[] = [];
    return { party: name, pendingIntents, pendingProposals, activeLoans, completedLoans, creditScore };
  }
  async creditScore(party: string): Promise<any> {
    const pid = await this.lookupParty(party);
    if (!pid) return { tier: "Bronze", loansRepaid: 0, loansDefaulted: 0, collateralMultiplier: TIER_MULTIPLIER.Bronze };
    return this.creditScoreView(pid);
  }

  // 2-phase lend (TTL slot map — the one piece of acceptable pre-ledger BE state)
  // Phase-1 reserves a slot ONLY — no on-ledger mint. Previously lendInit minted an
  // unlocked, spendable Holding up front, which was never reclaimed if confirm never
  // came (and orphaned on BE restart). Now the Holding is minted at confirm time.
  private _lendSlots = new Map<string, { party: string; amount: number; instrument: string; durationDays: number; exp: number }>();
  private static SLOT_TTL_MS = 10 * 60_000;
  private sweepSlots() { const now = Date.now(); for (const [k, v] of this._lendSlots) if (now > v.exp) this._lendSlots.delete(k); }
  async lendInit(party: string, p: { amount: number; instrument?: string; durationDays?: number }): Promise<{ slotId: string; expiresAt: string; amount: number; instrument: string }> {
    this.sweepSlots();
    await this.ensureParty(party); // validate the caller resolves to a party
    const inst = p.instrument ?? "USD";
    const slotId = this.nid("slot");
    const exp = Date.now() + CantonLedger.SLOT_TTL_MS;
    this._lendSlots.set(slotId, { party, amount: p.amount, instrument: inst, durationDays: p.durationDays ?? 30, exp });
    return { slotId, expiresAt: new Date(exp).toISOString(), amount: p.amount, instrument: inst };
  }
  async lendConfirm(party: string, slotId: string, rate: number): Promise<Bid> {
    this.sweepSlots();
    const s = this._lendSlots.get(slotId);
    if (!s || Date.now() > s.exp || s.party !== party) {
      this._lendSlots.delete(slotId);
      const e: any = new Error("lend slot expired or unknown"); e.status = 410; throw e;
    }
    this._lendSlots.delete(slotId);
    const lender = await this.ensureParty(party);
    const cust = await this.ensureParty("Custodian");
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    // mint + lock the funds now (at confirm), so an abandoned init leaves no ledger state
    const cash = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: lender, amount: String(s.amount), instrument: s.instrument, locker: null }), "Asset:Holding");
    const locked = this.made(await this.exercise([lender], "Asset:Holding", cash.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([lender], "Lending:SealedBid", { lender, matchingOperator: op, auditor: aud, bidId: this.nid("bid"), holdingCid: locked.cid, amount: String(s.amount), bidRate: String(rate), instrument: s.instrument, deadline: deadlineFrom(s.durationDays) });
    return this.bidDto(this.made(tree, "Lending:SealedBid"));
  }

  // collateral quote
  async collateralQuote(party: string, amount: number, instrument = "USD"): Promise<{ party: string; instrument: string; amount: number; tier: Tier; multiplier: number; price: number | null; priceKnown: boolean; requiredCollateral: number }> {
    const op = await this.ensureParty("Operator");
    // READ-ONLY: resolve without allocating and without creating a CreditScore. An
    // unknown/unscored borrower quotes at the Bronze default.
    const bor = await this.lookupParty(party);
    const scored = bor ? (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === bor) : undefined;
    const tier: Tier = (scored?.arg.tier as Tier) ?? "Bronze";
    const multiplier = TIER_MULTIPLIER[tier];
    const prices = (await this.acsAs(op, "Settlement:PriceUpdate")).filter((pr) => pr.arg.instrument === instrument);
    prices.sort((a, b) => String(a.arg.asOf).localeCompare(String(b.arg.asOf)));
    const latest = prices[prices.length - 1];
    const price = latest ? Number(latest.arg.price) : null;
    const priceKnown = typeof price === "number" && Number.isFinite(price) && price > 0;
    const requiredCollateral = priceKnown ? (amount * multiplier) / (price as number) : amount * multiplier;
    return { party: bor ? nameOf(bor) : party, instrument, amount, tier, multiplier, price, priceKnown, requiredCollateral };
  }

  // expire-proposals (report-only: operator can't finalize a borrower-controlled proposal)
  private _propSeen = new Map<string, number>();
  private static PROPOSAL_TTL_MS = 5 * 60_000;
  private notePropSightings(cids: string[]) { const now = Date.now(); for (const c of cids) if (!this._propSeen.has(c)) this._propSeen.set(c, now); }
  async expireProposals(): Promise<{ checked: number; expired: number; stale: { proposalId: string; borrower: string; ageMs: number }[]; policy: string; note: string }> {
    const op = await this.ensureParty("Operator");
    const props = await this.acsAs(op, "Settlement:MatchProposal");
    const live = new Set(props.map((p) => p.cid));
    this.notePropSightings(props.map((p) => p.cid));
    for (const k of [...this._propSeen.keys()]) if (!live.has(k)) this._propSeen.delete(k);
    const now = Date.now();
    const stale = props
      .map((p) => ({ p, ageMs: now - (this._propSeen.get(p.cid) ?? now) }))
      .filter((x) => x.ageMs > CantonLedger.PROPOSAL_TTL_MS)
      .map((x) => ({ proposalId: x.p.cid, borrower: nameOf(x.p.arg.borrower), ageMs: x.ageMs }));
    return { checked: props.length, expired: 0, stale, policy: "report", note: "operator cannot Accept/Reject (both controller=borrower); auto-accept needs SC MatchProposal.expiresAt + operator ExpireAccept choice. Reported stale proposals only." };
  }

  // public market feed (aggregate-only; never a rate or identity)
  async market(): Promise<{ instruments: { instrument: string; openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number | null; totalOpenBorrowVolume: number | null; avgLoanSize: number | null }[] }> {
    const op = await this.ensureParty("Operator");
    const [bids, borrows, loans] = await Promise.all([
      this.acsAs(op, "Lending:SealedBid"),
      this.acsAs(op, "Lending:BorrowIntent"),
      this.acsAs(op, "Settlement:Loan"),
    ]);
    type Agg = { openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number; totalOpenBorrowVolume: number; loanPrincipalSum: number; lenders: Set<string>; borrowers: Set<string> };
    const byInst = new Map<string, Agg>();
    const bucket = (inst: string): Agg => {
      const key = inst || "USD";
      let a = byInst.get(key);
      if (!a) { a = { openBids: 0, openBorrows: 0, activeLoans: 0, totalOpenLendVolume: 0, totalOpenBorrowVolume: 0, loanPrincipalSum: 0, lenders: new Set(), borrowers: new Set() }; byInst.set(key, a); }
      return a;
    };
    for (const b of bids) { const a = bucket(b.arg.instrument); a.openBids++; a.totalOpenLendVolume += Number(b.arg.amount); a.lenders.add(String(b.arg.lender)); }
    for (const b of borrows) { const a = bucket(b.arg.instrument); a.openBorrows++; a.totalOpenBorrowVolume += Number(b.arg.amount); a.borrowers.add(String(b.arg.borrower)); }
    for (const l of loans) { const a = bucket(l.arg.instrument); a.activeLoans++; a.loanPrincipalSum += Number(l.arg.principal); }
    // k-anonymity: a volume aggregated over a single distinct participant IS that
    // participant's exact position. Suppress (null) any volume backed by < 2 distinct parties.
    const MIN_K = 2;
    const instruments = [...byInst.entries()]
      .map(([instrument, a]) => ({ instrument, openBids: a.openBids, openBorrows: a.openBorrows, activeLoans: a.activeLoans,
        totalOpenLendVolume: a.lenders.size >= MIN_K ? a.totalOpenLendVolume : null,
        totalOpenBorrowVolume: a.borrowers.size >= MIN_K ? a.totalOpenBorrowVolume : null,
        avgLoanSize: a.activeLoans >= MIN_K ? a.loanPrincipalSum / a.activeLoans : null }))
      .sort((x, y) => x.instrument.localeCompare(y.instrument));
    return { instruments };
  }
}
