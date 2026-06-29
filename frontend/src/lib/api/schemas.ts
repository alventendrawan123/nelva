import { z } from "zod";

export const tierSchema = z.enum(["Bronze", "Silver", "Gold", "Platinum"]);

export const bidSchema = z.object({
  bidId: z.string(),
  lender: z.string(),
  amount: z.number(),
  rate: z.number(),
  instrument: z.string(),
  status: z.enum(["OPEN", "MATCHED", "WITHDRAWN"]),
  deadline: z.string(),
});

export const borrowIntentSchema = z.object({
  borrowId: z.string(),
  borrower: z.string(),
  amount: z.number(),
  maxRate: z.number(),
  tier: tierSchema,
  requiredCollateral: z.number(),
  collateralAmount: z.number(),
  instrument: z.string(),
  status: z.enum(["OPEN", "MATCHED"]),
});

export const tickSchema = z.object({
  lender: z.string(),
  bidId: z.string(),
  amount: z.number(),
  rate: z.number(),
});

export const matchProposalSchema = z.object({
  proposalId: z.string(),
  borrowId: z.string(),
  borrower: z.string(),
  principal: z.number(),
  blendedRate: z.number(),
  tier: tierSchema,
  ticks: z.array(tickSchema),
  inputBidIds: z.array(z.string()),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
});

export const loanSchema = z.object({
  loanId: z.string(),
  borrower: z.string(),
  principal: z.number(),
  blendedRate: z.number(),
  ticks: z.array(tickSchema),
  collateralAmount: z.number(),
  tier: tierSchema,
  maturity: z.string(),
  status: z.enum(["ACTIVE", "REPAID", "LIQUIDATED"]),
});

export const auditBadgeSchema = z.object({
  proposalId: z.string(),
  verdict: z.enum(["GREEN", "RED"]),
  reason: z.string(),
  auditor: z.string(),
  checkedAt: z.string(),
});

export const statusSchema = z.object({
  openBids: z.number(),
  activeLoans: z.number(),
  proposals: z.number(),
  lastMatchAt: z.string().nullable(),
});

export const lensViewSchema = z.object({
  subject: z
    .object({
      proposalId: z.string(),
      borrower: z.string(),
      principal: z.number(),
    })
    .nullable(),
  perspectives: z.object({
    lender: z.object({
      party: z.string().nullable(),
      canSee: z.array(z.string()),
      bids: z.array(bidSchema),
    }),
    borrower: z.object({
      party: z.string().nullable(),
      canSee: z.array(z.string()),
      proposal: matchProposalSchema.nullable(),
    }),
    operator: z.object({
      canSee: z.array(z.string()),
      bids: z.array(bidSchema),
      proposal: matchProposalSchema.nullable(),
    }),
    auditor: z.object({
      canSee: z.array(z.string()),
      bids: z.array(bidSchema),
      badge: auditBadgeSchema.nullable(),
    }),
    outsider: z.object({
      canSee: z.array(z.string()),
      status: statusSchema,
    }),
  }),
});

export type Tier = z.infer<typeof tierSchema>;
export type Bid = z.infer<typeof bidSchema>;
export type BorrowIntent = z.infer<typeof borrowIntentSchema>;
export type Tick = z.infer<typeof tickSchema>;
export type MatchProposal = z.infer<typeof matchProposalSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type AuditBadge = z.infer<typeof auditBadgeSchema>;
export type Status = z.infer<typeof statusSchema>;
export type LensView = z.infer<typeof lensViewSchema>;
