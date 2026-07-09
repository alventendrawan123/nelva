import { z } from "zod";

export const tierSchema = z.enum(["Bronze", "Silver", "Gold", "Platinum"]);

export const bidSchema = z.object({
  bidId: z.string(),
  cid: z.string().optional(),
  lender: z.string(),
  amount: z.number(),
  rate: z.number(),
  instrument: z.string(),
  status: z.enum(["OPEN", "MATCHED", "WITHDRAWN"]),
  deadline: z.string(),
});

export const borrowIntentSchema = z.object({
  borrowId: z.string(),
  cid: z.string().optional(),
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
  requiredCollateral: z.number(),
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
    lender: z
      .object({
        party: z.string().nullable(),
        canSee: z.array(z.string()),
        bids: z.array(bidSchema),
      })
      .optional(),
    borrower: z
      .object({
        party: z.string().nullable(),
        canSee: z.array(z.string()),
        proposal: matchProposalSchema.nullable(),
      })
      .optional(),
    operator: z
      .object({
        canSee: z.array(z.string()),
        bids: z.array(bidSchema),
        proposal: matchProposalSchema.nullable(),
      })
      .optional(),
    auditor: z
      .object({
        canSee: z.array(z.string()),
        bids: z.array(bidSchema),
        badge: auditBadgeSchema.nullable(),
      })
      .optional(),
    outsider: z.object({
      canSee: z.array(z.string()),
      status: statusSchema,
    }),
  }),
});

export const lenderPositionSchema = z.object({
  loanId: z.string(),
  borrower: z.string(),
  maturity: z.string(),
  myPrincipal: z.number(),
  myRate: z.number(),
  owedToMe: z.number(),
});

export const lenderStatusSchema = z.object({
  party: z.string(),
  activeLends: z.array(bidSchema),
  activeLoans: z.array(lenderPositionSchema),
  completedLoans: z.array(z.unknown()),
  pendingPayouts: z.array(
    z.object({
      loanId: z.string(),
      borrower: z.string(),
      amount: z.number(),
      maturity: z.string(),
    }),
  ),
});

export const holdingSchema = z.object({
  instrument: z.string(),
  amount: z.number(),
  locked: z.boolean(),
});

export const meSchema = z.object({
  party: z.string().nullable().optional(),
  role: z.string(),
  partyId: z.string().nullable(),
});

export const creditScoreSchema = z.object({
  tier: tierSchema,
  loansRepaid: z.number(),
  loansDefaulted: z.number(),
  collateralMultiplier: z.number(),
});

export const collateralQuoteSchema = z.object({
  party: z.string(),
  instrument: z.string(),
  amount: z.number(),
  tier: tierSchema,
  multiplier: z.number(),
  price: z.number().nullable(),
  priceKnown: z.boolean(),
  requiredCollateral: z.number(),
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
export type Holding = z.infer<typeof holdingSchema>;
export type Me = z.infer<typeof meSchema>;
export type LenderPosition = z.infer<typeof lenderPositionSchema>;
export type LenderStatus = z.infer<typeof lenderStatusSchema>;
export type CreditScore = z.infer<typeof creditScoreSchema>;
export type CollateralQuote = z.infer<typeof collateralQuoteSchema>;
