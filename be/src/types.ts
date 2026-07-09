// Shared types — mirror the Daml model + the API contract in docs/2_TECH_SPEC §5.6.
// NOTE: mock uses JS numbers for amounts/rates for simplicity. The production
// contract recommends string decimals (avoid float); swap at the ledger adapter.

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type Role = "lender" | "borrower" | "operator" | "auditor" | "oracle" | "outsider";

// dev: party name -> role (Bearer token = party name = perspective)
export function roleOf(party?: string): Role {
  if (!party) return "outsider";
  if (party === "Operator") return "operator";
  if (party === "Auditor") return "auditor";
  if (party === "Oracle") return "oracle";
  if (party.startsWith("Lender")) return "lender";
  if (party.startsWith("Borrower")) return "borrower";
  return "outsider";
}

export const TIER_MULTIPLIER: Record<Tier, number> = {
  Bronze: 2.0,
  Silver: 1.8,
  Gold: 1.5,
  Platinum: 1.2,
};

export interface Bid {
  bidId: string;
  cid?: string; // on-ledger contract id — needed for a wallet to WithdrawBid (own signature)
  txOffset?: number; // ledger offset of the creating tx — resolves to its tx hash via /api/tx-by-offset
  lender: string;
  amount: number;
  rate: number; // lender's reservation rate, e.g. 0.05
  instrument: string;
  status: "OPEN" | "MATCHED" | "WITHDRAWN";
  deadline: string;
}

export interface BorrowIntent {
  borrowId: string;
  cid?: string; // on-ledger contract id — needed for a wallet to Cancel (own signature)
  txOffset?: number; // ledger offset of the creating tx — resolves to its tx hash via /api/tx-by-offset
  borrower: string;
  amount: number;
  maxRate: number;
  tier: Tier;
  requiredCollateral: number;
  collateralAmount: number;
  instrument: string;
  status: "OPEN" | "MATCHED";
}

export interface Tick {
  lender: string;
  bidId: string;
  amount: number;
  rate: number; // discriminatory: each lender keeps its own rate
}

export interface MatchProposal {
  proposalId: string;
  borrowId: string;
  borrower: string;
  principal: number;
  blendedRate: number;
  tier: Tier;
  ticks: Tick[];
  inputBidIds: string[]; // FULL set incl losers (for audit completeness)
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}

export interface Loan {
  loanId: string;
  borrower: string;
  principal: number;
  blendedRate: number;
  ticks: Tick[];
  collateralAmount: number;
  requiredCollateral: number;
  txOffset?: number; // ledger offset of the creating tx — resolves to its tx hash via /api/tx-by-offset
  tier: Tier;
  maturity: string;
  status: "ACTIVE" | "REPAID" | "LIQUIDATED";
}

export interface AuditBadge {
  proposalId: string;
  verdict: "GREEN" | "RED";
  reason: string;
  auditor: string;
  checkedAt: string;
}

export interface PriceUpdate {
  instrument: string;
  price: number;
  asOf: string;
}

// A party's on-ledger holding (real wallet view — from Asset:Holding contracts).
export interface HoldingView {
  instrument: string;
  amount: number;
  locked: boolean;
}
