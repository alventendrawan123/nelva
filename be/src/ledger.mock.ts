// In-memory mock Ledger — wraps src/store.ts and applies viewer-scoped privacy
// in the list* methods (mimicking Canton's per-party projection).
import type { Ledger } from "./ledger.js";
import { roleOf } from "./types.js";
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge } from "./types.js";
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
    return S.db.proposals.filter((p) => p.borrower === viewer);
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
}
