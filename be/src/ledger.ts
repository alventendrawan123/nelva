// Ledger interface + factory. server.ts talks ONLY to this, so swapping the
// in-memory mock for the real Canton JSON Ledger API needs no route changes.
// Pick the impl with env LEDGER_MODE=mock (default) | canton.
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, HoldingView } from "./types.js";
import { MockLedger } from "./ledger.mock.js";
import { CantonLedger } from "./ledger.canton.js";

export interface Ledger {
  seed(): Promise<void>;
  status(): Promise<any>;
  // lender
  createBid(party: string, p: { amount: number; rate: number; instrument?: string; durationDays?: number }): Promise<Bid>;
  listBids(viewer?: string): Promise<Bid[]>; // privacy-scoped by viewer
  withdrawBid(party: string, bidId: string): Promise<any>;
  // borrower
  createBorrow(party: string, p: { amount: number; maxRate: number; collateralAmount: number; instrument?: string }): Promise<BorrowIntent>;
  listBorrows(viewer?: string): Promise<BorrowIntent[]>;
  listProposals(viewer?: string): Promise<MatchProposal[]>;
  accept(party: string, proposalId: string): Promise<Loan>;
  reject(party: string, proposalId: string): Promise<any>;
  listLoans(viewer?: string): Promise<Loan[]>;
  repay(party: string, loanId: string): Promise<any>;
  // operator
  runMatch(): Promise<MatchProposal[]>;
  runCheatMatch(): Promise<MatchProposal[]>;
  setPrice(instrument: string, price: number): Promise<any>;
  liquidate(loanId: string): Promise<any>;
  // auditor
  auditBids(): Promise<Bid[]>;
  verify(auditor: string, proposalId: string): Promise<AuditBadge>;
  listBadges(): Promise<AuditBadge[]>;
  // hero
  lens(proposalId: string): Promise<any>;
  // wallet (real, from ledger)
  holdings(viewer?: string): Promise<HoldingView[]>;
  partyId(name: string): Promise<string | null>;
  // external-party wallet relay (canton only; BE never holds the key)
  walletOnboard(partyHint: string, publicKeyB64: string): Promise<any>;
  walletAllocate(topologyTransactions: any[], fingerprint: string, multiHashSig: string): Promise<any>;
  walletPrepare(party: string, commands: any[]): Promise<any>;
  walletExecute(party: string, preparedTransaction: string, hashingSchemeVersion: string, fingerprint: string, sig: string): Promise<any>;
  config(): Promise<any>;
  walletHoldings(party: string): Promise<any[]>;
}

export const LEDGER_MODE = process.env.LEDGER_MODE === "canton" ? "canton" : "mock";
export const ledger: Ledger = LEDGER_MODE === "canton" ? new CantonLedger() : new MockLedger();
