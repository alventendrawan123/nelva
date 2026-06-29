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
const PKG = process.env.NELVA_PACKAGE_ID ?? "2ca7c73857de562d7a62f1550384a577c24fa1c5db614c4fd4028c7ddb1847fe";
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
    return { borrowId: a.borrowId, borrower: nameOf(a.borrower), amount: Number(a.amount), maxRate: Number(a.maxRate), tier, requiredCollateral: Number(a.amount) * TIER_MULTIPLIER[tier], collateralAmount: 0, instrument: a.instrument, status: "OPEN" };
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
    const coll = this.made(await this.create([cust], "Asset:Holding", { custodian: cust, owner: bor, amount: String(p.collateralAmount), instrument: inst, locker: null }), "Asset:Holding");
    const lc = this.made(await this.exercise([bor], "Asset:Holding", coll.cid, "Lock", { newLocker: op }), "Asset:Holding");
    const tree = await this.create([bor], "Lending:BorrowIntent", { borrower: bor, matchingOperator: op, auditor: aud, borrowId: this.nid("borrow"), collateralCid: lc.cid, amount: String(p.amount), maxRate: String(p.maxRate), tier: "Bronze", instrument: inst, deadline: DEADLINE });
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
    if (!bids.length || !borrows.length) return [];
    const rnd = this.made(await this.create([op], "Settlement:MatchRound", { operator: op, auditor: aud }), "Settlement:MatchRound");
    const tree = await this.exercise([op], "Settlement:MatchRound", rnd.cid, "RunMatch", { bidCids: bids.map((b) => b.cid), borrowCids: borrows.map((b) => b.cid) });
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
}
