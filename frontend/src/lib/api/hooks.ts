"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeedback } from "@/context/FeedbackContext";
import { useParty } from "@/context/PartyContext";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api/endpoints";
import { borrowAsWallet, placeBidAsWallet } from "@/lib/wallet/commands";

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
  return useQuery({ queryKey: keys.status, queryFn: api.status });
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
  });
}

export function useMyBids() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.bids(party),
    queryFn: () => api.myBids(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useMyBorrows() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.borrows(party),
    queryFn: () => api.myBorrows(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useProposals() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.proposals(party),
    queryFn: () => api.proposals(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useLoans() {
  const { party } = useParty();
  return useQuery({
    queryKey: keys.loans(party),
    queryFn: () => api.loans(party ?? ""),
    enabled: Boolean(party),
  });
}

export function useLens(proposalId: string) {
  return useQuery({
    queryKey: keys.lens(proposalId),
    queryFn: () => api.lens(proposalId),
    enabled: Boolean(proposalId),
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
  };
}

function useMarketCallbacks(successMessage: string) {
  const invalidate = useInvalidateMarket();
  const { showSuccess, showError } = useFeedback();
  return {
    onSuccess: () => {
      invalidate();
      showSuccess(successMessage);
    },
    onError: (error: Error) => showError(error.message),
  };
}

export function usePlaceBid() {
  const { party } = useParty();
  const { partyId } = useWallet();
  return useMutation({
    // a connected wallet signs the bid itself; otherwise the demo persona path
    mutationFn: ({ amount, rate }: { amount: number; rate: number }): Promise<void> =>
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
    }): Promise<void> =>
      partyId
        ? borrowAsWallet(input.amount, input.maxRate, input.collateralAmount)
        : api
            .borrow(party ?? "", input.amount, input.maxRate, input.collateralAmount)
            .then(() => undefined),
    ...useMarketCallbacks("Borrow intent submitted."),
  });
}

export function useAccept() {
  const { party } = useParty();
  return useMutation({
    mutationFn: (proposalId: string) => api.accept(party ?? "", proposalId),
    ...useMarketCallbacks("Proposal accepted - loan created."),
  });
}

export function useReject() {
  const { party } = useParty();
  return useMutation({
    mutationFn: (proposalId: string) => api.reject(party ?? "", proposalId),
    ...useMarketCallbacks("Proposal rejected."),
  });
}

export function useRepay() {
  const { party } = useParty();
  return useMutation({
    mutationFn: (loanId: string) => api.repay(party ?? "", loanId),
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
