"use client";

import { useState } from "react";
import { QueryState } from "@/components/shared/QueryState";
import { AmountField } from "@/components/ui/AmountField";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenChip } from "@/components/ui/TokenChip";
import {
  useAccept,
  useBorrow,
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
      <Card className="space-y-4 p-6">
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
        <SealedHint message="Your max rate is encrypted and hidden from the server." />
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

      <section className="mt-8">
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
              <Card
                key={loan.loanId}
                className="flex items-center justify-between p-5"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {formatAmount(loan.principal)} at{" "}
                    {formatRate(loan.blendedRate)}
                  </p>
                  <p className="text-sm text-muted">
                    Collateral {formatAmount(loan.collateralAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={loan.status === "ACTIVE" ? "accent" : "success"}>
                    {loan.status}
                  </Badge>
                  {loan.status === "ACTIVE" ? (
                    <Button
                      variant="secondary"
                      onClick={() => repay.mutate(loan.loanId)}
                      disabled={repay.isPending}
                    >
                      Repay
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </ul>
        </QueryState>
      </section>
    </div>
  );
}
