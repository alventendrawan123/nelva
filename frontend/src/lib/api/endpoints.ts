import { call } from "@/lib/api/client";
import {
  type AuditBadge,
  auditBadgeSchema,
  type Bid,
  type BorrowIntent,
  bidSchema,
  borrowIntentSchema,
  type CollateralQuote,
  type CreditScore,
  collateralQuoteSchema,
  creditScoreSchema,
  type Holding,
  holdingSchema,
  type LenderStatus,
  type LensView,
  type Loan,
  lenderStatusSchema,
  lensViewSchema,
  loanSchema,
  type MatchProposal,
  type Me,
  matchProposalSchema,
  meSchema,
  type Status,
  statusSchema,
  type TxDetails,
  txDetailsSchema,
} from "@/lib/api/schemas";

const OPERATOR = "Operator";
const AUDITOR = "Auditor";

export const api = {
  status: () => call<Status>("/status", { schema: statusSchema }),

  me: (party: string) => call<Me>("/me", { party, schema: meSchema }),
  holdings: (party: string) =>
    call<Holding[]>("/wallet/holdings", {
      party,
      schema: holdingSchema.array(),
    }),
  faucet: (party: string) => call("/faucet", { party, method: "POST" }),

  myBids: (party: string) =>
    call<Bid[]>("/bids", { party, schema: bidSchema.array() }),
  placeBid: (party: string, amount: number, rate: number) =>
    call<Bid>("/bids", {
      party,
      body: { amount, rate, instrument: "USD", durationDays: 30 },
      schema: bidSchema,
    }),

  myBorrows: (party: string) =>
    call<BorrowIntent[]>("/borrow", {
      party,
      schema: borrowIntentSchema.array(),
    }),
  borrow: (
    party: string,
    amount: number,
    maxRate: number,
    collateralAmount: number,
  ) =>
    call<BorrowIntent>("/borrow", {
      party,
      body: { amount, maxRate, collateralAmount, instrument: "USD" },
      schema: borrowIntentSchema,
    }),

  proposals: (party: string) =>
    call<MatchProposal[]>("/proposals", {
      party,
      schema: matchProposalSchema.array(),
    }),
  accept: (party: string, proposalId: string) =>
    call<Loan>(`/proposals/${proposalId}/accept`, {
      party,
      method: "POST",
      schema: loanSchema,
    }),
  reject: (party: string, proposalId: string) =>
    call(`/proposals/${proposalId}/reject`, { party, method: "POST" }),
  withdrawBid: (party: string, bidId: string) =>
    call(`/bids/${bidId}`, { party, method: "DELETE" }),
  cancelBorrow: (party: string, borrowId: string) =>
    call(`/borrow/${borrowId}`, { party, method: "DELETE" }),

  loans: (party: string) =>
    call<Loan[]>("/loans", { party, schema: loanSchema.array() }),
  repay: (party: string, loanId: string) =>
    call(`/loans/${loanId}/repay`, { party, method: "POST" }),
  claimExcess: (party: string, loanId: string) =>
    call(`/loans/${loanId}/claim-excess`, { party, method: "POST" }),

  // tx hash (Canton update id) of the transaction that created a contract, by ACS offset
  txByOffset: (offset: number) =>
    call<{ updateId: string }>(`/tx-by-offset?offset=${offset}`, {}),
  // Nelva Explorer: live transaction details straight from the Canton ledger
  txDetails: (updateId: string) =>
    call<TxDetails>(`/tx/${encodeURIComponent(updateId)}`, {
      schema: txDetailsSchema,
    }),

  runMatch: () =>
    call<{ proposals: MatchProposal[] }>("/admin/run-match", {
      party: OPERATOR,
      method: "POST",
    }),
  cheatMatch: () =>
    call<{ proposals: MatchProposal[] }>("/admin/cheat-match", {
      party: OPERATOR,
      method: "POST",
    }),
  setPrice: (price: number) =>
    call("/admin/price", {
      party: OPERATOR,
      body: { instrument: "USD", price },
    }),
  liquidate: (loanId: string) =>
    call(`/admin/liquidate/${loanId}`, { party: OPERATOR, method: "POST" }),
  seed: () => call("/admin/seed", { party: OPERATOR, method: "POST" }),

  auditBids: () =>
    call<Bid[]>("/audit/bids", { party: AUDITOR, schema: bidSchema.array() }),
  verify: (proposalId: string) =>
    call<AuditBadge>(`/audit/verify/${proposalId}`, {
      party: AUDITOR,
      method: "POST",
      schema: auditBadgeSchema,
    }),
  badges: () =>
    call<AuditBadge[]>("/audit/badges", {
      party: AUDITOR,
      schema: auditBadgeSchema.array(),
    }),

  lenderStatus: (party: string) =>
    call<LenderStatus>(`/lender-status/${party}`, {
      party,
      schema: lenderStatusSchema,
    }),
  creditScore: (party: string) =>
    call<CreditScore>(`/credit-score/${party}`, {
      party,
      schema: creditScoreSchema,
    }),
  collateralQuote: (party: string, amount: number) =>
    call<CollateralQuote>(
      `/collateral-quote?party=${party}&amount=${amount}&instrument=USD`,
      { party, schema: collateralQuoteSchema },
    ),

  lens: (proposalId: string, viewer: string = OPERATOR) =>
    call<LensView>(`/lens?proposalId=${proposalId}`, {
      party: viewer,
      schema: lensViewSchema,
    }),
};
