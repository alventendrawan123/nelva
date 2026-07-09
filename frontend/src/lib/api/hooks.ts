"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeedback } from "@/context/FeedbackContext";
import { useParty } from "@/context/PartyContext";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api/endpoints";
import {
  acceptAsWallet,
  borrowAsWallet,
  cancelBorrowAsWallet,
  claimExcessAsWallet,
  placeBidAsWallet,
  rejectAsWallet,
  repayAsWallet,
  withdrawBidAsWallet,
} from "@/lib/wallet/commands";
import type { Bid, BorrowIntent, Loan } from "@/lib/api/schemas";

const keys = {
  status: ["status"] as const,
  bids: (party?: string) => ["bids", party] as const,
  borrows: (party?: string) => ["borrows", party] as const,
  proposals: (party?: string) => ["proposals", party] as const,
  loans: (party?: string) => ["loans", party] as const,
  auditBids: ["audit-bids"] as const,
  badges: ["badges"] as const,
  lens: (proposalId: string) => ["lens", proposalId] as const,
};

export function useStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: api.status,
    refetchInterval: 15000,
  });
}

export function useMe() {
  const { party } = useParty();
  return useQuery({
    queryKey: ["me", party],
    queryFn: () => api.me(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useHoldings() {
  const { party } = useParty();
  return useQuery({
    queryKey: ["holdings", party],
    queryFn: () => api.holdings(party ?? ""),
    enabled: Boolean(party),
    refetchInterval: 8000,
  });
}

export function useFaucet() {
  const { party } = useParty();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useFeedback();
  return useMutation({
    mutationFn: () => api.faucet(party ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      showSuccess("Test nUSD added to your wallet.");
    },
    onError: (error: Error) => showError(error.message),
  });
}

// Party-scoped feeds poll so the operator's auto-matcher is visible LIVE: a just-posted
// bid/borrow flips OPEN -> MATCHED and its pending proposal appears without a manual refresh.
const FEED_POLL_MS = 4000;

export function useMyBids() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.bids(party),
    queryFn: () => api.myBids(party ?? ""),
    enabled: Boolean(party),
    refetchInterval: FEED_POLL_MS,
  });
}

export function useMyBorrows() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.borrows(party),
    queryFn: () => api.myBorrows(party ?? ""),
    enabled: Boolean(party),
    refetchInterval: FEED_POLL_MS,
  });
}

export function useProposals() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.proposals(party),
    queryFn: () => api.proposals(party ?? ""),
    enabled: Boolean(party),
    refetchInterval: FEED_POLL_MS,
  });
}

export function useLoans() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.loans(party),
    queryFn: () => api.loans(party ?? ""),
    enabled: Boolean(party),
    refetchInterval: FEED_POLL_MS,
  });
}

export function useLens(proposalId: string) {
  return useQuery({
    queryKey: keys.lens(proposalId),
    queryFn: () => api.lens(proposalId),
    enabled: Boolean(proposalId),
  });
}

// The Lens is a public teaching view: read proposals as the operator so it
// always has one to inspect, regardless of the connected wallet's scope.
export function useLensProposals() {
  return useQuery({
    queryKey: ["proposals", "Operator"],
    queryFn: () => api.proposals("Operator"),
    refetchInterval: FEED_POLL_MS,
  });
}

export function useLenderStatus() {
  const { party } = useParty();
  return useQuery({
    queryKey: ["lender-status", party],
    queryFn: () => api.lenderStatus(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useCreditScore() {
  const { party } = useParty();
  return useQuery({
    queryKey: ["credit-score", party],
    queryFn: () => api.creditScore(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useCollateralQuote(amount: number) {
  const { party } = useParty();
  return useQuery({
    queryKey: ["collateral-quote", party, amount],
    queryFn: () => api.collateralQuote(party ?? "", amount),
    enabled: Boolean(party) && amount > 0,
  });
}

function useInvalidateMarket() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["status"] });
    queryClient.invalidateQueries({ queryKey: ["bids"] });
    queryClient.invalidateQueries({ queryKey: ["borrows"] });
    queryClient.invalidateQueries({ queryKey: ["proposals"] });
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    queryClient.invalidateQueries({ queryKey: ["lens"] });
    queryClient.invalidateQueries({ queryKey: ["holdings"] });
    // A repay bumps the borrower's tier, which changes the required collateral. Without these the
    // borrow form kept quoting the OLD tier (e.g. "Gold 1.5x -> 150" after a repay already ranked
    // the borrower up to Platinum 1.2x -> 120), so a borrower over-posted collateral by mistake.
    queryClient.invalidateQueries({ queryKey: ["credit-score"] });
    queryClient.invalidateQueries({ queryKey: ["collateral-quote"] });
    queryClient.invalidateQueries({ queryKey: ["lender-status"] });
  };
}

function useMarketCallbacks(successMessage: string) {
  const invalidate = useInvalidateMarket();
  const { showSuccess, showError } = useFeedback();
  return {
    // wallet-path mutations resolve with the committed transaction's update id (tx hash);
    // show it so every lender/borrower action is traceable to a real on-ledger transaction.
    // (admin mutations resolve with other shapes — only a string result is treated as a tx id)
    onSuccess: (data?: unknown) => {
      invalidate();
      const txId = typeof data === "string" && data ? data : undefined;
      showSuccess(
        txId ? `${successMessage} · tx ${txId.slice(0, 24)}…` : successMessage,
      );
    },
    onError: (error: Error) => {
      // A rejected action is often a stale cache — a loan/bid/borrow the ledger already archived
      // (e.g. clicking Claim/Repay on a contract a prior action consumed). Refetch on error too so
      // the phantom row disappears instead of leaving the user clicking a ghost in an error loop.
      invalidate();
      showError(error.message);
    },
  };
}

export function usePlaceBid() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    // a connected wallet signs the bid itself; otherwise the demo persona path
    mutationFn: ({
      amount,
      rate,
    }: {
      amount: number;
      rate: number;
    }): Promise<string | void> =>
      partyId
        ? placeBidAsWallet(amount, rate)
        : api.placeBid(party ?? "", amount, rate).then(() => undefined),
    ...useMarketCallbacks("Sealed bid submitted."),
  });
}

export function useBorrow() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (input: {
      amount: number;
      maxRate: number;
      collateralAmount: number;
    }): Promise<string | void> =>
      partyId
        ? borrowAsWallet(input.amount, input.maxRate, input.collateralAmount)
        : api
            .borrow(
              party ?? "",
              input.amount,
              input.maxRate,
              input.collateralAmount,
            )
            .then(() => undefined),
    ...useMarketCallbacks("Borrow intent submitted."),
  });
}

export function useAccept() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (proposalId: string): Promise<string | void> =>
      partyId
        ? acceptAsWallet(proposalId)
        : api.accept(party ?? "", proposalId).then(() => undefined),
    ...useMarketCallbacks("Proposal accepted - loan created."),
  });
}

export function useReject() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (proposalId: string): Promise<string | void> =>
      partyId
        ? rejectAsWallet(proposalId)
        : api.reject(party ?? "", proposalId).then(() => undefined),
    ...useMarketCallbacks("Proposal rejected."),
  });
}

// A wallet signs on its own contract id (bid.cid / borrow.cid); the demo persona path uses the
// app-assigned id the BE resolves back to a contract id.
export function useWithdrawBid() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (bid: Bid): Promise<string | void> =>
      partyId
        ? withdrawBidAsWallet(bid.cid ?? "")
        : api.withdrawBid(party ?? "", bid.bidId).then(() => undefined),
    ...useMarketCallbacks("Bid withdrawn - funds returned."),
  });
}

export function useCancelBorrow() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (borrow: BorrowIntent): Promise<string | void> =>
      partyId
        ? cancelBorrowAsWallet(borrow.cid ?? "")
        : api.cancelBorrow(party ?? "", borrow.borrowId).then(() => undefined),
    ...useMarketCallbacks("Borrow cancelled - collateral returned."),
  });
}

export function useClaimExcess() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    // loanId IS the contract id, so both paths take loan.loanId.
    mutationFn: (loan: Loan): Promise<string | void> =>
      partyId
        ? claimExcessAsWallet(loan.loanId)
        : api.claimExcess(party ?? "", loan.loanId).then(() => undefined),
    ...useMarketCallbacks("Excess collateral claimed."),
  });
}

export function useRepay() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    mutationFn: (loanId: string): Promise<string | void> =>
      partyId
        ? repayAsWallet(loanId)
        : api.repay(party ?? "", loanId).then(() => undefined),
    ...useMarketCallbacks("Loan repaid."),
  });
}

export function useRunMatch() {
  return useMutation({
    mutationFn: api.runMatch,
    ...useMarketCallbacks("Match run - proposal created."),
  });
}

export function useCheatMatch() {
  return useMutation({
    mutationFn: api.cheatMatch,
    ...useMarketCallbacks("Cheat match created."),
  });
}

export function useSeed() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useFeedback();
  return useMutation({
    mutationFn: api.seed,
    onSuccess: () => {
      queryClient.invalidateQueries();
      showSuccess("Demo data reset.");
    },
    onError: (error: Error) => showError(error.message),
  });
}

const TIER_MULTIPLIER: Record<string, string> = {
  Bronze: "2x",
  Silver: "1.8x",
  Gold: "1.5x",
  Platinum: "1.2x",
};

export function useProfile() {
  const { party } = useParty();
  const bids = useMyBids();
  const borrows = useMyBorrows();
  const loans = useLoans();

  const loanList = loans.data ?? [];
  const bidList = bids.data ?? [];
  const borrowList = borrows.data ?? [];
  const tier = borrowList[0]?.tier ?? loanList[0]?.tier ?? "Bronze";
  const loansRepaid = loanList.filter(
    (loan) => loan.status === "REPAID",
  ).length;

  return {
    isLoading: bids.isLoading || borrows.isLoading || loans.isLoading,
    isError: bids.isError || borrows.isError || loans.isError,
    address: party ?? "Outsider",
    tier,
    collateralMultiplier: TIER_MULTIPLIER[tier] ?? "2x",
    repScore: loansRepaid,
    stats: {
      loansRepaid,
      defaulted: loanList.filter((loan) => loan.status === "LIQUIDATED").length,
      activeBorrows: loanList.filter((loan) => loan.status === "ACTIVE").length,
      activeLends: bidList.filter((bid) => bid.status === "MATCHED").length,
      pendingIntents:
        borrowList.filter((borrow) => borrow.status === "OPEN").length +
        bidList.filter((bid) => bid.status === "OPEN").length,
    },
    loans: loanList,
  };
}

export function useVerify() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useFeedback();
  return useMutation({
    mutationFn: (proposalId: string) => api.verify(proposalId),
    onSuccess: (data, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ["lens", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      showSuccess(`Audit complete - verdict ${data.verdict}.`);
    },
    onError: (error: Error) => showError(error.message),
  });
}
