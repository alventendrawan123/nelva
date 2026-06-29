import { call } from "@/lib/api/client";
import {
  type AuditBadge,
  auditBadgeSchema,
  type Bid,
  type BorrowIntent,
  bidSchema,
  borrowIntentSchema,
  type LensView,
  type Loan,
  lensViewSchema,
  loanSchema,
  type MatchProposal,
  matchProposalSchema,
  type Status,
  statusSchema,
} from "@/lib/api/schemas";

const OPERATOR = "Operator";
const AUDITOR = "Auditor";

export const api = {
  status: () => call<Status>("/status", { schema: statusSchema }),

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

  loans: (party: string) =>
    call<Loan[]>("/loans", { party, schema: loanSchema.array() }),
  repay: (party: string, loanId: string) =>
    call(`/loans/${loanId}/repay`, { party, method: "POST" }),

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

  lens: (proposalId: string) =>
    call<LensView>(`/lens?proposalId=${proposalId}`, {
      schema: lensViewSchema,
    }),
};
