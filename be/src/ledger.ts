// Ledger interface + factory. server.ts talks ONLY to this interface, so the impl
// (the real Canton JSON Ledger API) can change without touching any route.
import type { Bid, BorrowIntent, MatchProposal, Loan, AuditBadge, HoldingView, Tier, Role } from "./types.js";
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
  // hero (perspective scoped to the caller's role/party)
  lens(proposalId: string, viewer?: string, role?: Role): Promise<any>;
  // wallet (real, from ledger)
  holdings(viewer?: string): Promise<HoldingView[]>;
  partyId(name: string): Promise<string | null>;
  // external-party wallet relay (canton only; BE never holds the key)
  walletOnboard(partyHint: string, publicKeyB64: string): Promise<any>;
  walletAllocate(topologyTransactions: any[], fingerprint: string, multiHashSig: string): Promise<any>;
  walletPrepare(party: string, commands: any[], disclosedContracts?: any[]): Promise<any>;
  walletExecute(party: string, preparedTransaction: string, hashingSchemeVersion: string, fingerprint: string, sig: string): Promise<any>;
  config(): Promise<any>;
  walletHoldings(party: string): Promise<any[]>;
  walletAcceptInfo(proposalCid: string): Promise<any>;
  walletRepayInfo(party: string, loanId: string): Promise<any>;
  walletFaucet(party: string): Promise<any>;

  // ── extended additions ──
  cancelBorrow(party: string, borrowId: string): Promise<any>;
  claimExcess(party: string, loanId: string): Promise<any>;
  swapQuote(p: { instrumentIn: string; instrumentOut: string; amountIn: number }): Promise<{ instrumentIn: string; instrumentOut: string; amountIn: number; amountOut: number; priceIn: number; priceOut: number; rate: number }>;
  swap(party: string, p: { instrumentIn: string; instrumentOut: string; amountIn: number; minAmountOut?: number }): Promise<{ holdingCid: string; amountOut: number; instrumentOut: string }>;
  lenderStatus(party: string): Promise<any>;
  borrowerStatus(party: string): Promise<any>;
  creditScore(party: string): Promise<any>;
  lendInit(party: string, p: { amount: number; instrument?: string; durationDays?: number }): Promise<{ slotId: string; expiresAt: string; amount: number; instrument: string }>;
  lendConfirm(party: string, slotId: string, rate: number): Promise<Bid>;
  collateralQuote(party: string, amount: number, instrument?: string): Promise<{ party: string; instrument: string; amount: number; tier: Tier; multiplier: number; price: number | null; priceKnown: boolean; requiredCollateral: number }>;
  expireProposals(): Promise<{ checked: number; expired: number; stale: { proposalId: string; borrower: string; ageMs: number }[]; policy: string; note: string }>;
  market(): Promise<{ instruments: { instrument: string; openBids: number; openBorrows: number; activeLoans: number; totalOpenLendVolume: number | null; totalOpenBorrowVolume: number | null; avgLoanSize: number | null }[] }>;
}

// Canton-only: the BE always talks to the real JSON Ledger API (dpm sandbox or DevNet).
export const LEDGER_MODE = "canton";
export const ledger: Ledger = new CantonLedger();
