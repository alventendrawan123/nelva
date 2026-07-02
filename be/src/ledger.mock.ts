// In-memory mock Ledger — wraps src/store.ts and applies viewer-scoped privacy
// in the list* methods (mimicking Canton's per-party projection).
import type { Ledger } from "./ledger.js";
import { roleOf, TIER_MULTIPLIER } from "./types.js";
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, HoldingView, Tier } from "./types.js";
import * as S from "./store.js";

export class MockLedger implements Ledger {
  async seed() { S.seed(); }
  async status() { return S.status(); }

  async createBid(party: string, p: { amount: number; rate: number; instrument?: string; durationDays?: number }): Promise<Bid> {
    return S.createBid(party, p.amount, p.rate, p.instrument ?? "USD", p.durationDays ?? 30);
  }
  async listBids(viewer?: string): Promise<Bid[]> {
    const r = roleOf(viewer);
    if (r === "operator" || r === "auditor") return S.db.bids;
    if (r === "lender") return S.db.bids.filter((b) => b.lender === viewer);
    return []; // outsiders/borrowers cannot see bids
  }
  async withdrawBid(party: string, bidId: string) { return S.withdrawBid(bidId, party); }

  async createBorrow(party: string, p: { amount: number; maxRate: number; collateralAmount: number; instrument?: string }): Promise<BorrowIntent> {
    return S.createBorrow(party, p.amount, p.maxRate, p.collateralAmount, p.instrument ?? "USD");
  }
  async listBorrows(viewer?: string): Promise<BorrowIntent[]> {
    const r = roleOf(viewer);
    if (r === "operator" || r === "auditor") return S.db.borrows;
    return S.db.borrows.filter((b) => b.borrower === viewer);
  }
  async listProposals(viewer?: string): Promise<MatchProposal[]> {
    const r = roleOf(viewer);
    if (r === "operator" || r === "auditor") return S.db.proposals;
    // borrower sees own; matched lenders see proposals they're in (parity with Canton observers)
    return S.db.proposals.filter((p) => p.borrower === viewer || p.ticks.some((t) => t.lender === viewer));
  }
  async accept(_party: string, proposalId: string): Promise<Loan> { return S.accept(proposalId); }
  async reject(_party: string, proposalId: string) { return S.reject(proposalId); }
  async listLoans(viewer?: string): Promise<Loan[]> {
    const r = roleOf(viewer);
    if (r === "operator" || r === "auditor") return S.db.loans;
    if (r === "lender") return S.db.loans.filter((l) => l.ticks.some((t) => t.lender === viewer));
    return S.db.loans.filter((l) => l.borrower === viewer);
  }
  async repay(_party: string, loanId: string) { return S.repay(loanId); }

  async runMatch() { return S.runMatch(); }
  async runCheatMatch() { return S.runCheatMatch(); }
  async setPrice(instrument: string, price: number) { return S.setPrice(instrument, price); }
  async liquidate(loanId: string) { return S.liquidate(loanId); }

  async auditBids(): Promise<Bid[]> { return S.db.bids; }
  async verify(auditor: string, proposalId: string): Promise<AuditBadge> { return S.verify(auditor, proposalId); }
  async listBadges(): Promise<AuditBadge[]> { return S.db.badges; }

  async lens(proposalId: string) { return S.lens(proposalId); }

  async holdings(viewer?: string): Promise<HoldingView[]> {
    if (!viewer) return [];
    const START = 1000;
    const lockedBids = S.db.bids
      .filter((b) => b.lender === viewer && (b.status === "OPEN" || b.status === "MATCHED"))
      .reduce((a, b) => a + b.amount, 0);
    const lockedColl = S.db.borrows
      .filter((b) => b.borrower === viewer && (b.status === "OPEN" || b.status === "MATCHED"))
      .reduce((a, b) => a + b.collateralAmount, 0);
    const locked = lockedBids + lockedColl;
    const out: HoldingView[] = [{ instrument: "USD", amount: Math.max(0, START - locked), locked: false }];
    if (locked > 0) out.push({ instrument: "USD", amount: locked, locked: true });
    return out;
  }
  async partyId(name: string): Promise<string | null> { return name || null; }

  private noWallet(): never { throw new Error("connect-wallet (external signing) requires LEDGER_MODE=canton"); }
  async walletOnboard(): Promise<any> { this.noWallet(); }
  async walletAllocate(): Promise<any> { this.noWallet(); }
  async walletPrepare(): Promise<any> { this.noWallet(); }
  async walletExecute(): Promise<any> { this.noWallet(); }
  async config(): Promise<any> { return { packageId: "mock", parties: { operator: "Operator", auditor: "Auditor", custodian: "Custodian" } }; }
  async walletHoldings(): Promise<any[]> { this.noWallet(); }
  async walletAcceptInfo(): Promise<any> { this.noWallet(); }
  async walletRepayInfo(): Promise<any> { this.noWallet(); }
  async walletFaucet(): Promise<any> { this.noWallet(); }

  // ── extended stubs (functional against the in-memory store) ──
  async cancelBorrow(party: string, borrowId: string): Promise<any> {
    const b = S.db.borrows.find((x) => x.borrowId === borrowId && x.borrower === party);
    if (!b) throw new Error("borrow not found");
    if (b.status !== "OPEN") throw new Error("borrow already matched");
    S.db.borrows = S.db.borrows.filter((x) => x !== b);
    return { borrowId, status: "CANCELLED" };
  }
  async claimExcess(party: string, loanId: string): Promise<any> {
    const l = S.db.loans.find((x) => x.loanId === loanId && x.borrower === party);
    if (!l) throw new Error("loan not found");
    const required = l.principal * TIER_MULTIPLIER[l.tier];
    const excess = l.collateralAmount - required;
    if (!(excess > 0)) throw new Error("no excess collateral to claim");
    l.collateralAmount = required;
    return { loanId, excessReturned: excess, remainingCollateral: required };
  }
  async swapQuote(p: { instrumentIn: string; instrumentOut: string; amountIn: number }) {
    const pin = S.db.prices.find((x) => x.instrument === p.instrumentIn)?.price;
    const pout = S.db.prices.find((x) => x.instrument === p.instrumentOut)?.price;
    if (!pin) throw new Error(`no price for ${p.instrumentIn}`);
    if (!pout) throw new Error(`no price for ${p.instrumentOut}`);
    const amountOut = (p.amountIn * pin) / pout;
    return { instrumentIn: p.instrumentIn, instrumentOut: p.instrumentOut, amountIn: p.amountIn, amountOut, priceIn: pin, priceOut: pout, rate: pin / pout };
  }
  async swap(party: string, p: { instrumentIn: string; instrumentOut: string; amountIn: number; minAmountOut?: number }) {
    const q = await this.swapQuote(p);
    if (q.amountOut < (p.minAmountOut ?? 0)) throw new Error("slippage: amountOut < minAmountOut");
    return { holdingCid: `mock-swap-${party}-${Date.now().toString(36)}`, amountOut: q.amountOut, instrumentOut: p.instrumentOut };
  }
  async lenderStatus(party: string): Promise<any> {
    const activeLends = S.db.bids.filter((b) => b.lender === party && b.status === "OPEN");
    const activeLoans = S.db.loans.filter((l) => l.status === "ACTIVE" && l.ticks.some((t) => t.lender === party));
    return { party, activeLends, activeLoans, completedLoans: [], pendingPayouts: [] };
  }
  async borrowerStatus(party: string): Promise<any> {
    return {
      party,
      pendingIntents: S.db.borrows.filter((b) => b.borrower === party && b.status === "OPEN"),
      pendingProposals: S.db.proposals.filter((p) => p.borrower === party && p.status === "PENDING"),
      activeLoans: S.db.loans.filter((l) => l.borrower === party && l.status === "ACTIVE"),
      completedLoans: [],
      creditScore: { tier: "Bronze" as Tier, loansRepaid: 0, loansDefaulted: 0, collateralMultiplier: TIER_MULTIPLIER.Bronze },
    };
  }
  async creditScore(_party: string): Promise<any> {
    return { tier: "Bronze" as Tier, loansRepaid: 0, loansDefaulted: 0, collateralMultiplier: TIER_MULTIPLIER.Bronze };
  }
  private _slots = new Map<string, { party: string; amount: number; instrument: string; durationDays: number; exp: number }>();
  async lendInit(party: string, p: { amount: number; instrument?: string; durationDays?: number }) {
    const slotId = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const instrument = p.instrument ?? "USD"; const exp = Date.now() + 10 * 60_000;
    this._slots.set(slotId, { party, amount: p.amount, instrument, durationDays: p.durationDays ?? 30, exp });
    return { slotId, expiresAt: new Date(exp).toISOString(), amount: p.amount, instrument };
  }
  async lendConfirm(party: string, slotId: string, rate: number): Promise<Bid> {
    const s = this._slots.get(slotId);
    if (!s || Date.now() > s.exp || s.party !== party) { this._slots.delete(slotId); const e: any = new Error("lend slot expired or unknown"); e.status = 410; throw e; }
    this._slots.delete(slotId);
    return S.createBid(party, s.amount, rate, s.instrument, s.durationDays);
  }
  async collateralQuote(party: string, amount: number, instrument = "USD") {
    const b = S.db.borrows.find((x) => x.borrower === party);
    const tier = (b?.tier ?? "Bronze") as Tier; const multiplier = TIER_MULTIPLIER[tier];
    const price = S.db.prices.find((p) => p.instrument === instrument)?.price ?? null;
    const priceKnown = typeof price === "number" && price > 0;
    const requiredCollateral = priceKnown ? (amount * multiplier) / (price as number) : amount * multiplier;
    return { party, instrument, amount, tier, multiplier, price, priceKnown, requiredCollateral };
  }
  async expireProposals() { return { checked: S.db.proposals.length, expired: 0, stale: [], policy: "report", note: "mock: no expiry clock" }; }
  async market(): Promise<{ instruments: { instrument: string; openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number; totalOpenBorrowVolume: number; avgLoanSize: number }[] }> {
    type Agg = { openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number; totalOpenBorrowVolume: number; loanPrincipalSum: number };
    const byInst = new Map<string, Agg>();
    const bucket = (inst?: string): Agg => {
      const key = inst || "USD";
      let a = byInst.get(key);
      if (!a) { a = { openBids: 0, openBorrows: 0, activeLoans: 0, totalOpenLendVolume: 0, totalOpenBorrowVolume: 0, loanPrincipalSum: 0 }; byInst.set(key, a); }
      return a;
    };
    for (const b of S.db.bids) if (b.status === "OPEN") { const a = bucket(b.instrument); a.openBids++; a.totalOpenLendVolume += b.amount; }
    for (const b of S.db.borrows) if (b.status === "OPEN") { const a = bucket(b.instrument); a.openBorrows++; a.totalOpenBorrowVolume += b.amount; }
    for (const l of S.db.loans) if (l.status === "ACTIVE") { const a = bucket((l as any).instrument); a.activeLoans++; a.loanPrincipalSum += l.principal; }
    const instruments = [...byInst.entries()]
      .map(([instrument, a]) => ({ instrument, openBids: a.openBids, openBorrows: a.openBorrows, activeLoans: a.activeLoans, totalOpenLendVolume: a.totalOpenLendVolume, totalOpenBorrowVolume: a.totalOpenBorrowVolume, avgLoanSize: a.activeLoans ? a.loanPrincipalSum / a.activeLoans : 0 }))
      .sort((x, y) => x.instrument.localeCompare(y.instrument));
    return { instruments };
  }
}
