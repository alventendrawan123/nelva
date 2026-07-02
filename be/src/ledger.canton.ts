// Real Canton adapter — talks to the JSON Ledger API v2 (e.g. dpm sandbox on 7575).
// Uses the recipe verified end-to-end on the sandbox (see be/skill.md + memory):
// POST /v2/parties (allocate, fallback lookup), submit-and-wait-for-transaction-tree
// (extract created cids), POST /v2/state/active-contracts (filtersByParty = per-party
// privacy). Privacy in the Lens is REAL here — each party-scoped read returns only
// that party's projected slice.
import type { Ledger } from "./ledger.js";
import { TIER_MULTIPLIER } from "./types.js";
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, Tier, HoldingView } from "./types.js";
import { cheatMatch, type BidInput } from "./match.js";

const BASE = process.env.JSON_LEDGER_API ?? "http://localhost:7575";
// package id of the deployed DAR — UPDATE on every SC rebuild (dpm damlc inspect-dar --json)
const PKG = process.env.NELVA_PACKAGE_ID ?? "e60f573a2bb609093d80bf0d655bcc3359b19e08857766b4a9c68a3396bae284";
const USER = process.env.LEDGER_USER_ID ?? "nelva-be";
const DEADLINE = "2030-01-01T00:00:00Z";

const tid = (s: string) => `${PKG}:Nelva.${s}`;
const nameOf = (pid: string) => (pid ? pid.split("::")[0] : pid);

// OAuth2 client_credentials token provider (cached). When AUTH_TOKEN_URL is
// unset (e.g. dpm sandbox) NO Authorization header is sent — backward compatible.
// On DevNet / LocalNet / NaaS, set AUTH_* and every Ledger API call is Bearer-authed.
let _tok: { value: string; exp: number } | null = null;
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
  return { Authorization: `Bearer ${_tok.value}` };
}

async function post(path: string, body: any): Promise<any> {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) });
  const txt = await r.text();
  if (r.status === 401) { _tok = null; } // force refresh next call
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : {};
}
async function get(path: string): Promise<any> {
  const r = await fetch(BASE + path, { headers: { ...(await authHeader()) } });
  if (r.status === 401) { _tok = null; }
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

type CW = { cid: string; arg: any }; // contract wrapper

export class CantonLedger implements Ledger {
  private parties = new Map<string, string>();
  private seq = 0;
  private nid(p: string) { return `${p}-${Date.now().toString(36)}-${++this.seq}`; }

  private async ensureParty(name: string): Promise<string> {
    if (name.includes("::")) return name; // already a full party-id (e.g. an external wallet party) — use as-is
    const c = this.parties.get(name);
    if (c) return c;
    try {
      const r = await post("/v2/parties", { partyIdHint: name });
      const pid = r.partyDetails.party;
      this.parties.set(name, pid);
      return pid;
    } catch {
      const d = await get("/v2/parties");
      const list = d.partyDetails ?? d.parties ?? [];
      for (const pd of list) {
        const pid = typeof pd === "string" ? pd : pd.party;
        if (pid && pid.split("::")[0] === name) { this.parties.set(name, pid); return pid; }
      }
      throw new Error(`cannot allocate or find party ${name}`);
    }
  }

  private async submit(actAs: string[], command: any, readAs?: string[]) {
    const body: any = { commands: [command], commandId: this.nid("c"), userId: USER, actAs };
    if (readAs) body.readAs = readAs;
    const r = await post("/v2/commands/submit-and-wait-for-transaction-tree", body);
    return r.transactionTree;
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
    const arr: any[] = await post("/v2/state/active-contracts", {
      activeAtOffset: end,
      eventFormat: { filtersByParty: { [party]: {} }, verbose: true },
    });
    const out: CW[] = [];
    for (const e of arr) {
      const ce = e?.contractEntry?.JsActiveContract?.createdEvent;
      if (ce && String(ce.templateId).endsWith("Nelva." + tmpl)) out.push({ cid: ce.contractId, arg: ce.createArgument });
    }
    return out;
  }

  // ── mappers ──
  private bidDto(x: CW): Bid {
    const a = x.arg;
    return { bidId: a.bidId, lender: nameOf(a.lender), amount: Number(a.amount), rate: Number(a.bidRate), instrument: a.instrument, status: "OPEN", deadline: a.deadline };
  }
  private borrowDto(x: CW): BorrowIntent {
    const a = x.arg, tier = a.tier as Tier;
    const collateralAmount = Number(a.collateralAmount ?? 0);
    return { borrowId: a.borrowId, borrower: nameOf(a.borrower), amount: Number(a.amount), maxRate: Number(a.maxRate), tier, requiredCollateral: Number(a.amount) * TIER_MULTIPLIER[tier], collateralAmount, instrument: a.instrument, status: "OPEN" };
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

  private async ensureCreditScore(borrowerPid: string): Promise<string> {
    const op = await this.ensureParty("Operator");
    const existing = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === borrowerPid);
    if (existing) return existing.cid;
    const tree = await this.create([op], "Credit:CreditScore", { operator: op, borrower: borrowerPid, tier: "Bronze", loansRepaid: 0, loansDefaulted: 0 });
    return this.made(tree, "Credit:CreditScore").cid;
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
    await this.createBid("LenderA", { amount: 100, rate: 0.03 });
    await this.createBid("LenderB", { amount: 100, rate: 0.05 });
    await this.createBorrow("Borrower", { amount: 150, maxRate: 0.06, collateralAmount: 300 });
    // spare unlocked cash → wallet shows "available + locked", not 0
    await this.fund("LenderA", 50);
    await this.fund("LenderB", 50);
    await this.fund("Borrower", 100);
  }

  async createBid(party: string, p: { amount: number; rate: number; instrument?: string; durationDays?: number }): Promise<Bid> {
    const lender = await this.ensureParty(party);
    const cust = await this.ensureParty("Custodian");
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const inst = p.instrument ?? "USD";
    const cash = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: lender, amount: String(p.amount), instrument: inst, locker: null }), "Asset:Holding");
    const locked = this.made(await this.exercise([lender], "Asset:Holding", cash.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([lender], "Lending:SealedBid", { lender, matchingOperator: op, auditor: aud, bidId: this.nid("bid"), holdingCid: locked.cid, amount: String(p.amount), bidRate: String(p.rate), instrument: inst, deadline: DEADLINE });
    return this.bidDto(this.made(tree, "Lending:SealedBid"));
  }
  async listBids(viewer?: string): Promise<Bid[]> {
    if (!viewer) return [];
    return (await this.acsAs(await this.ensureParty(viewer), "Lending:SealedBid")).map((x) => this.bidDto(x));
  }
  async withdrawBid(party: string, bidId: string): Promise<any> {
    const pid = await this.ensureParty(party);
    const bid = (await this.acsAs(pid, "Lending:SealedBid")).find((b) => b.arg.bidId === bidId);
    if (!bid) throw new Error("bid not found");
    await this.exercise([pid], "Lending:SealedBid", bid.cid, "WithdrawBid", {}); // SC-gated: only after deadline
    return { bidId, status: "WITHDRAWN" };
  }

  async createBorrow(party: string, p: { amount: number; maxRate: number; collateralAmount: number; instrument?: string }): Promise<BorrowIntent> {
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
    const dto = this.borrowDto(this.made(tree, "Lending:BorrowIntent"));
    dto.collateralAmount = p.collateralAmount;
    return dto;
  }
  async listBorrows(viewer?: string): Promise<BorrowIntent[]> {
    if (!viewer) return [];
    return (await this.acsAs(await this.ensureParty(viewer), "Lending:BorrowIntent")).map((x) => this.borrowDto(x));
  }
  async listProposals(viewer?: string): Promise<MatchProposal[]> {
    if (!viewer) return [];
    return (await this.acsAs(await this.ensureParty(viewer), "Settlement:MatchProposal")).map((x) => this.propDto(x));
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
    await this.exercise([bor], "Settlement:Loan", loanId, "Repay", { repaymentCid: repayHolding.cid, creditScoreCid: cs }, [op]);
    const csNow = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === bor);
    return { loanId, status: "REPAID", newTier: csNow?.arg.tier ?? "Silver" };
  }

  async runMatch(): Promise<MatchProposal[]> {
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
    const freeBids = bids.filter((b) => !usedBids.has(b.cid));
    const freeBorrows = borrows.filter((b) => !usedBorrows.has(b.cid));
    if (!freeBids.length || !freeBorrows.length) return [];
    const rnd = this.made(await this.create([op], "Settlement:MatchRound", { operator: op, auditor: aud }), "Settlement:MatchRound");
    const tree = await this.exercise([op], "Settlement:MatchRound", rnd.cid, "RunMatch", { bidCids: freeBids.map((b) => b.cid), borrowCids: freeBorrows.map((b) => b.cid) });
    return this.allMade(tree, "Settlement:MatchProposal").map((x) => this.propDto(x));
  }
  async runCheatMatch(): Promise<MatchProposal[]> {
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const cust = await this.ensureParty("Custodian");
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
    const dummy = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: ba.borrower, amount: "1.0", instrument: "USD", locker: null }), "Asset:Holding");
    const tree = await this.create([op], "Settlement:MatchProposal", {
      operator: op, borrower: ba.borrower, auditor: aud, lenders: f.ticks.map((t) => t.lender),
      proposalId: "P-CHEAT", principal: String(f.principal), blendedRate: String(f.blendedRate), tier: ba.tier,
      matchedTicks: ticks, inputBidCids: bids.map((x) => x.cid), borrowCid: b.cid,
      collateralCid: dummy.cid, collateralAmount: "1.0", requiredCollateral: "0.0", instrument: "USD", maturity: DEADLINE,
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
    const price = (await this.acsAs(op, "Settlement:PriceUpdate")).find((p) => p.arg.instrument === inst);
    if (!price) throw new Error("no price set for " + inst + "; POST /api/admin/price first");
    const cs = await this.ensureCreditScore(loan.arg.borrower);
    await this.exercise([op], "Settlement:Loan", loanId, "Liquidate", { priceCid: price.cid, creditScoreCid: cs });
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

  async lens(proposalId: string) {
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const allBids = await this.acsAs(op, "Lending:SealedBid");
    const props = await this.acsAs(op, "Settlement:MatchProposal");
    const p = props.find((x) => x.cid === proposalId) ?? props[0] ?? null;
    const parg = p?.arg;
    const exLender: string | undefined = parg?.matchedTicks?.[0]?.lender;
    const lenderBids = exLender ? await this.acsAs(exLender, "Lending:SealedBid") : [];
    const badges = await this.acsAs(aud, "Settlement:AuditBadge");
    const badge = badges.find((x) => x.arg.proposalId === parg?.proposalId) ?? null;
    return {
      subject: parg ? { proposalId, borrower: nameOf(parg.borrower), principal: Number(parg.principal) } : null,
      perspectives: {
        lender: { party: exLender ? nameOf(exLender) : null, canSee: ["ownBid"], bids: lenderBids.map((x) => this.bidDto(x)) },
        borrower: { party: parg ? nameOf(parg.borrower) : null, canSee: ["proposal"], proposal: p ? this.propDto(p) : null },
        operator: { canSee: ["allBids", "proposal"], bids: allBids.map((x) => this.bidDto(x)), proposal: p ? this.propDto(p) : null },
        auditor: { canSee: ["allBids", "verdict"], bids: allBids.map((x) => this.bidDto(x)), badge: badge ? this.badgeDto(badge) : null },
        outsider: { canSee: ["status"], status: await this.status() },
      },
    };
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
    const pid = await this.ensureParty(viewer);
    const hs = await this.acsAs(pid, "Asset:Holding");
    return hs
      .filter((x) => x.arg.owner === pid)
      .map((x) => ({ instrument: x.arg.instrument, amount: Number(x.arg.amount), locked: x.arg.locker != null }));
  }
  async partyId(name: string): Promise<string | null> {
    if (!name) return null;
    return this.ensureParty(name);
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
      userId: USER, commandId: this.nid("wc"), actAs: [party], synchronizerId,
      commands, packageIdSelectionPreference: [], verboseHashing: true,
      disclosedContracts,
    });
    return { preparedTransaction: r.preparedTransaction, preparedTransactionHash: r.preparedTransactionHash, hashingSchemeVersion: r.hashingSchemeVersion };
  }

  // ACS (operator view) WITH createdEventBlob — needed to build disclosed contracts.
  private async acsWithBlobs(party: string): Promise<Map<string, { templateId: string; arg: any; blob: string }>> {
    const end = (await get("/v2/state/ledger-end")).offset;
    const arr: any[] = await post("/v2/state/active-contracts", {
      activeAtOffset: end,
      eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: true } } } }] } }, verbose: true },
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
    const blobs = await this.acsWithBlobs(op);
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
    const blobs = await this.acsWithBlobs(op);
    // the borrower can't see the CreditScore until it lands in its ACS, and never
    // sees the collateral escrow (DrawLocked to the operator at Accept) — Repay
    // transfers it back, so both must be disclosed for the wallet's prepare.
    const disclosed = [creditScoreCid, loan.arg.collateralCid]
      .map((cid) => {
        const c = blobs.get(cid);
        return c ? { templateId: c.templateId, contractId: cid, createdEventBlob: c.blob, synchronizerId: sync } : null;
      })
      .filter(Boolean);
    return { loanId, owed, creditScoreCid, disclosed };
  }
  // Fund a fresh wallet party (e.g. a Canton-gateway party with no faucet of its
  // own) with 200 nUSD, once — idempotent so it can't be drained by re-calling.
  async walletFaucet(party: string) {
    if (!party) throw new Error("party required");
    const pid = await this.ensureParty(party);
    const has = (await this.acsAs(pid, "Asset:Holding")).some((x) => x.arg.owner === pid);
    if (!has) await this.fundPid(pid, 200);
    return { party: pid, funded: !has };
  }
  // step 4: FE returns the signature over the prepared hash -> we submit. The key never left the browser.
  async walletExecute(party: string, preparedTransaction: string, hashingSchemeVersion: string, fingerprint: string, sig: string) {
    return post("/v2/interactive-submission/execute", {
      preparedTransaction, hashingSchemeVersion, userId: USER, submissionId: this.nid("we"),
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
    const pid = await this.ensureParty(party);
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
    // ClaimExcess (controller=borrower) Splits+Transfers the OPERATOR-owned escrow;
    // readAs=[op] so the borrower's submission can resolve loan.collateralCid (as accept/repay do).
    const tree = await this.exercise([bor], "Settlement:Loan", loanId, "ClaimExcess", {}, [op]);
    const newLoan = this.loanDto(this.made(tree, "Settlement:Loan"));
    return { loanId: newLoan.loanId, excessReturned: excess, remainingCollateral: requiredCollateral };
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
    const cust = await this.ensureParty("Custodian");
    const oracle = await this.ensureParty("Oracle");
    // demo: mint the swapper an UNLOCKED in-Holding of exactly amountIn.
    const inH = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: swapper, amount: String(p.amountIn), instrument: p.instrumentIn, locker: null }), "Asset:Holding");
    const [pin, pout] = await Promise.all([this.latestPrice(p.instrumentIn), this.latestPrice(p.instrumentOut)]);
    const amountOut = (p.amountIn * pin.price) / pout.price;
    const minOut = p.minAmountOut ?? 0;
    const pool = await this.ensureSwapPool();
    // actAs=[swapper, operator] (both controllers); readAs=[oracle] so the PriceUpdate contracts are visible.
    const tree = await this.exercise([swapper, op], "Settlement:SwapPool", pool, "Swap", {
      swapper, inCid: inH.cid, instrumentOut: p.instrumentOut,
      priceInCid: pin.cid, priceOutCid: pout.cid, minAmountOut: String(minOut),
    }, [oracle]);
    const out = this.made(tree, "Asset:Holding");
    return { holdingCid: out.cid, amountOut, instrumentOut: p.instrumentOut };
  }

  // consolidated dashboards (pure ACS fan-out)
  private async creditScoreView(borrowerPid: string): Promise<{ tier: Tier; loansRepaid: number; loansDefaulted: number; collateralMultiplier: number }> {
    await this.ensureCreditScore(borrowerPid);
    const op = await this.ensureParty("Operator");
    const cs = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === borrowerPid);
    const tier = (cs?.arg.tier ?? "Bronze") as Tier;
    return { tier, loansRepaid: Number(cs?.arg.loansRepaid ?? 0), loansDefaulted: Number(cs?.arg.loansDefaulted ?? 0), collateralMultiplier: TIER_MULTIPLIER[tier] };
  }
  async lenderStatus(party: string): Promise<any> {
    const pid = await this.ensureParty(party);
    const name = nameOf(pid);
    const activeLends = (await this.acsAs(pid, "Lending:SealedBid")).map((x) => this.bidDto(x));
    const loans = (await this.acsAs(pid, "Settlement:Loan")).map((x) => this.loanDto(x));
    const activeLoans = loans
      .filter((l) => l.ticks.some((t) => t.lender === name))
      .map((l) => {
        const mine = l.ticks.filter((t) => t.lender === name);
        const owedToMe = mine.reduce((a, t) => a + t.amount + t.amount * t.rate, 0);
        return { loanId: l.loanId, borrower: l.borrower, tier: l.tier, maturity: l.maturity, myTicks: mine, myPrincipal: mine.reduce((a, t) => a + t.amount, 0), owedToMe };
      });
    const completedLoans: any[] = [];
    const pendingPayouts = activeLoans.map((l) => ({ loanId: l.loanId, borrower: l.borrower, amount: l.owedToMe, maturity: l.maturity }));
    return { party: name, activeLends, activeLoans, completedLoans, pendingPayouts };
  }
  async borrowerStatus(party: string): Promise<any> {
    const pid = await this.ensureParty(party);
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
    const pid = await this.ensureParty(party);
    return this.creditScoreView(pid);
  }

  // 2-phase lend (TTL slot map — the one piece of acceptable pre-ledger BE state)
  private _lendSlots = new Map<string, { party: string; holdingCid: string; amount: number; instrument: string; durationDays: number; exp: number }>();
  private static SLOT_TTL_MS = 10 * 60_000;
  private sweepSlots() { const now = Date.now(); for (const [k, v] of this._lendSlots) if (now > v.exp) this._lendSlots.delete(k); }
  async lendInit(party: string, p: { amount: number; instrument?: string; durationDays?: number }): Promise<{ slotId: string; expiresAt: string; amount: number; instrument: string }> {
    this.sweepSlots();
    const lender = await this.ensureParty(party);
    const cust = await this.ensureParty("Custodian");
    const inst = p.instrument ?? "USD";
    const cash = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: lender, amount: String(p.amount), instrument: inst, locker: null }), "Asset:Holding");
    const slotId = this.nid("slot");
    const exp = Date.now() + CantonLedger.SLOT_TTL_MS;
    this._lendSlots.set(slotId, { party, holdingCid: cash.cid, amount: p.amount, instrument: inst, durationDays: p.durationDays ?? 30, exp });
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
    const op = await this.ensureParty("Operator");
    const aud = await this.ensureParty("Auditor");
    const locked = this.made(await this.exercise([lender], "Asset:Holding", s.holdingCid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([lender], "Lending:SealedBid", { lender, matchingOperator: op, auditor: aud, bidId: this.nid("bid"), holdingCid: locked.cid, amount: String(s.amount), bidRate: String(rate), instrument: s.instrument, deadline: DEADLINE });
    return this.bidDto(this.made(tree, "Lending:SealedBid"));
  }

  // collateral quote
  async collateralQuote(party: string, amount: number, instrument = "USD"): Promise<{ party: string; instrument: string; amount: number; tier: Tier; multiplier: number; price: number | null; priceKnown: boolean; requiredCollateral: number }> {
    const op = await this.ensureParty("Operator");
    const bor = await this.ensureParty(party);
    const scored = (await this.acsAs(op, "Credit:CreditScore")).find((x) => x.arg.borrower === bor);
    let tier: Tier = (scored?.arg.tier as Tier) ?? "Bronze";
    if (!scored) { await this.ensureCreditScore(bor); tier = "Bronze"; }
    const multiplier = TIER_MULTIPLIER[tier];
    const prices = (await this.acsAs(op, "Settlement:PriceUpdate")).filter((pr) => pr.arg.instrument === instrument);
    prices.sort((a, b) => String(a.arg.asOf).localeCompare(String(b.arg.asOf)));
    const latest = prices[prices.length - 1];
    const price = latest ? Number(latest.arg.price) : null;
    const priceKnown = typeof price === "number" && Number.isFinite(price) && price > 0;
    const requiredCollateral = priceKnown ? (amount * multiplier) / (price as number) : amount * multiplier;
    return { party: nameOf(bor), instrument, amount, tier, multiplier, price, priceKnown, requiredCollateral };
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
  async market(): Promise<{ instruments: { instrument: string; openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number; totalOpenBorrowVolume: number; avgLoanSize: number }[] }> {
    const op = await this.ensureParty("Operator");
    const [bids, borrows, loans] = await Promise.all([
      this.acsAs(op, "Lending:SealedBid"),
      this.acsAs(op, "Lending:BorrowIntent"),
      this.acsAs(op, "Settlement:Loan"),
    ]);
    type Agg = { openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number; totalOpenBorrowVolume: number; loanPrincipalSum: number };
    const byInst = new Map<string, Agg>();
    const bucket = (inst: string): Agg => {
      const key = inst || "USD";
      let a = byInst.get(key);
      if (!a) { a = { openBids: 0, openBorrows: 0, activeLoans: 0, totalOpenLendVolume: 0, totalOpenBorrowVolume: 0, loanPrincipalSum: 0 }; byInst.set(key, a); }
      return a;
    };
    for (const b of bids) { const a = bucket(b.arg.instrument); a.openBids++; a.totalOpenLendVolume += Number(b.arg.amount); }
    for (const b of borrows) { const a = bucket(b.arg.instrument); a.openBorrows++; a.totalOpenBorrowVolume += Number(b.arg.amount); }
    for (const l of loans) { const a = bucket(l.arg.instrument); a.activeLoans++; a.loanPrincipalSum += Number(l.arg.principal); }
    const instruments = [...byInst.entries()]
      .map(([instrument, a]) => ({ instrument, openBids: a.openBids, openBorrows: a.openBorrows, activeLoans: a.activeLoans, totalOpenLendVolume: a.totalOpenLendVolume, totalOpenBorrowVolume: a.totalOpenBorrowVolume, avgLoanSize: a.activeLoans ? a.loanPrincipalSum / a.activeLoans : 0 }))
      .sort((x, y) => x.instrument.localeCompare(y.instrument));
    return { instruments };
  }
}
