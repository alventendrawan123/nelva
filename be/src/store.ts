// In-memory mock "ledger". Swap this module for a real JSON Ledger API adapter
// (be/skill.md) to go live on Canton — the server routes stay the same.
import {
  Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, PriceUpdate,
  Tier, TIER_MULTIPLIER,
} from "./types.js";
import { runDeterministicMatch, cheatMatch, verifyMatch, BidInput, BorrowInput } from "./match.js";

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;
const nowIso = () => new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

const TIERS: Tier[] = ["Bronze", "Silver", "Gold", "Platinum"];
const upgrade = (t: Tier): Tier => TIERS[Math.min(TIERS.indexOf(t) + 1, TIERS.length - 1)];
const downgrade = (t: Tier): Tier => TIERS[Math.max(TIERS.indexOf(t) - 1, 0)];

interface State {
  bids: Bid[];
  borrows: BorrowIntent[];
  proposals: MatchProposal[];
  loans: Loan[];
  badges: AuditBadge[];
  prices: PriceUpdate[];
  tiers: Record<string, Tier>;
}
export const db: State = { bids: [], borrows: [], proposals: [], loans: [], badges: [], prices: [], tiers: {} };

const tierOf = (borrower: string): Tier => db.tiers[borrower] ?? "Bronze";
const toBidInput = (b: Bid): BidInput => ({ bidId: b.bidId, lender: b.lender, amount: b.amount, rate: b.rate });
const toBorrowInput = (b: BorrowIntent): BorrowInput => ({ borrowId: b.borrowId, borrower: b.borrower, amount: b.amount, maxRate: b.maxRate });

export function createBid(lender: string, amount: number, rate: number, instrument: string, durationDays: number): Bid {
  const bid: Bid = { bidId: id("bid"), lender, amount, rate, instrument, status: "OPEN", deadline: plusDays(durationDays) };
  db.bids.push(bid);
  return bid;
}

export function withdrawBid(bidId: string, lender: string): Bid {
  const bid = db.bids.find((b) => b.bidId === bidId && b.lender === lender);
  if (!bid) throw new Error("bid not found");
  bid.status = "WITHDRAWN";
  return bid;
}

export function createBorrow(borrower: string, amount: number, maxRate: number, collateralAmount: number, instrument: string): BorrowIntent {
  const tier = tierOf(borrower);
  const b: BorrowIntent = {
    borrowId: id("borrow"), borrower, amount, maxRate, tier,
    requiredCollateral: amount * TIER_MULTIPLIER[tier], collateralAmount, instrument, status: "OPEN",
  };
  db.borrows.push(b);
  return b;
}

function publish(useCheat: boolean): MatchProposal[] {
  const openBids = db.bids.filter((b) => b.status === "OPEN");
  const openBorrows = db.borrows.filter((b) => b.status === "OPEN");
  const inputIds = openBids.map((b) => b.bidId);
  const fills = (useCheat ? cheatMatch : runDeterministicMatch)(openBids.map(toBidInput), openBorrows.map(toBorrowInput));
  const created: MatchProposal[] = [];
  for (const f of fills) {
    const borrow = openBorrows.find((b) => b.borrowId === f.borrowId)!;
    const p: MatchProposal = {
      proposalId: id("P"), borrowId: f.borrowId, borrower: f.borrower,
      principal: f.principal, blendedRate: f.blendedRate, tier: borrow.tier,
      ticks: f.ticks, inputBidIds: inputIds, status: "PENDING",
    };
    db.proposals.push(p);
    created.push(p);
  }
  return created;
}
export const runMatch = () => publish(false);
export const runCheatMatch = () => publish(true);

export function verify(auditor: string, proposalId: string): AuditBadge {
  const p = db.proposals.find((x) => x.proposalId === proposalId);
  if (!p) throw new Error("proposal not found");
  const inputBids = db.bids.filter((b) => p.inputBidIds.includes(b.bidId)).map(toBidInput);
  const borrow = db.borrows.find((b) => b.borrowId === p.borrowId)!;
  const res = verifyMatch(inputBids, toBorrowInput(borrow), p.ticks, p.blendedRate);
  const badge: AuditBadge = { proposalId, verdict: res.verdict, reason: res.reason, auditor, checkedAt: nowIso() };
  db.badges = db.badges.filter((b) => b.proposalId !== proposalId);
  db.badges.push(badge);
  return badge;
}

export function accept(proposalId: string): Loan {
  const p = db.proposals.find((x) => x.proposalId === proposalId);
  if (!p) throw new Error("proposal not found");
  if (p.status !== "PENDING") throw new Error("proposal not pending");
  const borrow = db.borrows.find((b) => b.borrowId === p.borrowId)!;
  if (borrow.collateralAmount < borrow.requiredCollateral) throw new Error("under-collateralized");
  const loan: Loan = {
    loanId: id("L"), borrower: p.borrower, principal: p.principal, blendedRate: p.blendedRate,
    ticks: p.ticks, collateralAmount: borrow.collateralAmount, tier: p.tier,
    maturity: plusDays(30), status: "ACTIVE",
  };
  db.loans.push(loan);
  p.status = "ACCEPTED";
  borrow.status = "MATCHED";
  for (const t of p.ticks) {
    const bid = db.bids.find((b) => b.bidId === t.bidId);
    if (bid) bid.status = "MATCHED";
  }
  return loan;
}

export function reject(proposalId: string): MatchProposal {
  const p = db.proposals.find((x) => x.proposalId === proposalId);
  if (!p) throw new Error("proposal not found");
  p.status = "REJECTED";
  return p;
}

export function repay(loanId: string): { loanId: string; status: string; newTier: Tier } {
  const loan = db.loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("loan not found");
  loan.status = "REPAID";
  const newTier = upgrade(tierOf(loan.borrower));
  db.tiers[loan.borrower] = newTier;
  return { loanId, status: "REPAID", newTier };
}

export function setPrice(instrument: string, price: number): PriceUpdate {
  const pu: PriceUpdate = { instrument, price, asOf: nowIso() };
  db.prices = db.prices.filter((p) => p.instrument !== instrument);
  db.prices.push(pu);
  return pu;
}

export function liquidate(loanId: string): { loanId: string; status: string; distribution: Array<{ lender: string; share: number }>; fee: number; newTier: Tier } {
  const loan = db.loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("loan not found");
  const price = db.prices.find((p) => p.instrument === "USD")?.price ?? 1;
  const health = (loan.collateralAmount * price) / loan.principal;
  if (!(health < 1.5 || new Date() > new Date(loan.maturity))) throw new Error(`loan still healthy (health=${health})`);
  const fee = loan.collateralAmount * 0.05;
  const distributable = loan.collateralAmount - fee;
  const raw = loan.ticks.map((t) => ({ lender: t.lender, share: (distributable * t.amount) / loan.principal }));
  const summed = raw.reduce((a, x) => a + x.share, 0);
  if (raw.length > 0) raw[raw.length - 1].share += distributable - summed; // dust -> last
  loan.status = "LIQUIDATED";
  const newTier = downgrade(tierOf(loan.borrower));
  db.tiers[loan.borrower] = newTier;
  return { loanId, status: "LIQUIDATED", distribution: raw, fee, newTier };
}

// Lens: the SAME data projected per perspective (privacy is from the "ledger",
// not a FE filter). See docs/2_TECH_SPEC §6.
export function lens(proposalId: string) {
  const p = db.proposals.find((x) => x.proposalId === proposalId) ?? null;
  const allBids = p ? db.bids.filter((b) => p.inputBidIds.includes(b.bidId)) : [];
  const badge = p ? db.badges.find((b) => b.proposalId === proposalId) ?? null : null;
  const exampleLender = p?.ticks[0]?.lender ?? null;
  const ownBids = allBids.filter((b) => b.lender === exampleLender);
  return {
    subject: p ? { proposalId: p.proposalId, borrower: p.borrower, principal: p.principal } : null,
    perspectives: {
      lender: { party: exampleLender, canSee: ["ownBid", "ownTick", "loan"], bids: ownBids },
      borrower: { party: p?.borrower ?? null, canSee: ["ownIntent", "proposal", "loan"], proposal: p },
      operator: { canSee: ["allBids", "proposal"], bids: allBids, proposal: p },
      auditor: { canSee: ["allBids", "proposal", "verdict"], bids: allBids, badge },
      outsider: { canSee: ["status"], status: status() },
    },
  };
}

export function status() {
  return {
    openBids: db.bids.filter((b) => b.status === "OPEN").length,
    activeLoans: db.loans.filter((l) => l.status === "ACTIVE").length,
    proposals: db.proposals.length,
    lastMatchAt: db.proposals.length ? nowIso() : null,
  };
}

export function reset() {
  db.bids = []; db.borrows = []; db.proposals = []; db.loans = []; db.badges = []; db.prices = []; db.tiers = {};
  seq = 0;
}

// Seed demo data so the FE has something on first load.
export function seed() {
  reset();
  createBid("LenderA", 100, 0.03, "USD", 30);
  createBid("LenderB", 100, 0.05, "USD", 30);
  createBorrow("Borrower", 150, 0.06, 300, "USD");
  setPrice("USD", 1.0);
}
