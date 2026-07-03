"use client";

import { useState } from "react";
import { QueryState } from "@/components/shared/QueryState";
import { TxRow } from "@/components/shared/TxRow";
import { AmountField } from "@/components/ui/AmountField";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenChip } from "@/components/ui/TokenChip";
import {
  useAccept,
  useBorrow,
  useCollateralQuote,
  useLoans,
  useProposals,
  useReject,
  useRepay,
} from "@/lib/api/hooks";
import { formatAmount, formatRate, parseRatePercent } from "@/lib/format";
import { COLLATERAL, NUSD } from "@/lib/mock/tokens";
import { PanelHeading } from "./PanelHeading";
import { SealedHint } from "./SealedHint";

export function BorrowPanel() {
  const [amount, setAmount] = useState("0");
  const [collateral, setCollateral] = useState("0");
  const [maxRatePercent, setMaxRatePercent] = useState("6");

  const borrow = useBorrow();
  const quote = useCollateralQuote(Number(amount));
  const proposals = useProposals();
  const loans = useLoans();
  const accept = useAccept();
  const reject = useReject();
  const repay = useRepay();

  const handleSubmit = () => {
    borrow.mutate({
      amount: Number(amount),
      maxRate: parseRatePercent(maxRatePercent),
      collateralAmount: Number(collateral),
    });
  };

  const pendingProposals = proposals.data?.filter(
    (proposal) => proposal.status === "PENDING",
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PanelHeading
        title="Borrow with privacy"
        description="Submit a private borrow intent. Your max rate stays sealed and is only revealed inside Canton's deterministic matching engine."
      />
      <Card className="space-y-4 p-6" data-tour="borrow-form">
        <AmountField
          id="borrow-amount"
          label="You're borrowing"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          suffix={<TokenChip symbol={NUSD.symbol} />}
        />
        <AmountField
          id="borrow-collateral"
          label="Collateral"
          value={collateral}
          onChange={(event) => setCollateral(event.target.value)}
          inputMode="decimal"
          suffix={<TokenChip symbol={COLLATERAL.symbol} showChevron={false} />}
        />
        {quote.data ? (
          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
              Number(collateral) >= quote.data.requiredCollateral
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            <span>
              Required: {formatAmount(quote.data.requiredCollateral)} (
              {quote.data.tier} {quote.data.multiplier}x)
            </span>
            <span className="font-semibold">
              {Number(collateral) >= quote.data.requiredCollateral
                ? "Enough"
                : "Not enough"}
            </span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <AmountField
            id="borrow-max-rate"
            label="Max Rate (%)"
            value={maxRatePercent}
            onChange={(event) => setMaxRatePercent(event.target.value)}
            inputMode="decimal"
            fieldSize="md"
            suffix="%"
          />
          <AmountField
            id="borrow-duration"
            label="Duration (days)"
            defaultValue="30"
            inputMode="numeric"
            fieldSize="md"
            suffix="d"
          />
        </div>
        <SealedHint message="Your max rate is sealed — only the matching engine sees it, never rival borrowers. Canton privacy, not encryption." />
        {borrow.isError ? (
          <p className="text-sm text-danger">{borrow.error.message}</p>
        ) : null}
        <Button fullWidth onClick={handleSubmit} disabled={borrow.isPending}>
          {borrow.isPending ? "Submitting..." : "Submit Borrow Intent"}
        </Button>
      </Card>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          Match proposals
        </h2>
        <QueryState
          isLoading={proposals.isLoading}
          isError={proposals.isError}
          isEmpty={!pendingProposals || pendingProposals.length === 0}
          errorMessage="Could not load proposals."
          emptyMessage="No match proposals yet. The operator runs the match."
        >
          <ul className="space-y-3">
            {pendingProposals?.map((proposal) => (
              <Card key={proposal.proposalId} className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    {formatAmount(proposal.principal)} at{" "}
                    {formatRate(proposal.blendedRate)} blended
                  </p>
                  <Badge tone="accent">{proposal.tier}</Badge>
                </div>
                <ul className="space-y-1 text-sm text-muted">
                  {proposal.ticks.map((tick) => (
                    <li key={tick.bidId}>
                      {tick.lender}: {formatAmount(tick.amount)} at{" "}
                      {formatRate(tick.rate)}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button
                    onClick={() => accept.mutate(proposal.proposalId)}
                    disabled={accept.isPending}
                    data-tour="accept-btn"
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => reject.mutate(proposal.proposalId)}
                    disabled={reject.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        </QueryState>
      </section>

      <section className="mt-8" data-tour="loans-list">
        <h2 className="mb-3 text-lg font-bold text-foreground">Your loans</h2>
        <QueryState
          isLoading={loans.isLoading}
          isError={loans.isError}
          isEmpty={!loans.data || loans.data.length === 0}
          errorMessage="Could not load loans."
          emptyMessage="No active loans yet."
        >
          <ul className="space-y-3">
            {loans.data?.map((loan) => (
              <li key={loan.loanId}>
                <TxRow
                  symbol="nUSD"
                  title={`${formatAmount(loan.principal)} at ${formatRate(loan.blendedRate)}`}
                  subtitle={`Collateral ${formatAmount(loan.collateralAmount)}`}
                  idLabel={loan.loanId}
                  status={loan.status}
                  statusTone={loan.status === "ACTIVE" ? "accent" : "success"}
                  trailing={
                    loan.status === "ACTIVE" ? (
                      <Button
                        variant="secondary"
                        onClick={() => repay.mutate(loan.loanId)}
                        disabled={repay.isPending}
                        className="px-4 py-2 text-xs"
                      >
                        Repay
                      </Button>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        </QueryState>
      </section>
    </div>
  );
}
