"use client";

import { useState } from "react";
import { QueryState } from "@/components/shared/QueryState";
import { TxRow } from "@/components/shared/TxRow";
import { AmountField } from "@/components/ui/AmountField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenChip } from "@/components/ui/TokenChip";
import { useMyBids, usePlaceBid } from "@/lib/api/hooks";
import { formatAmount, formatRate, parseRatePercent } from "@/lib/format";
import { NUSD } from "@/lib/mock/tokens";
import { PanelHeading } from "./PanelHeading";
import { SealedHint } from "./SealedHint";

export function LendPanel() {
  const [amount, setAmount] = useState("0");
  const [ratePercent, setRatePercent] = useState("5");
  const bids = useMyBids();
  const placeBid = usePlaceBid();

  const handleSubmit = () => {
    placeBid.mutate({
      amount: Number(amount),
      rate: parseRatePercent(ratePercent),
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PanelHeading
        title="Lend privately on Nelva"
        description="Set your rate and deposit funds. Bids are sealed and matched cheapest first, so honest bidding is always your best strategy."
      />
      <Card className="space-y-4 p-6" data-tour="lend-form">
        <AmountField
          id="lend-amount"
          label="Amount to lend"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          suffix={<TokenChip symbol={NUSD.symbol} />}
        />
        <div className="grid grid-cols-2 gap-4">
          <AmountField
            id="lend-rate"
            label="Your Rate (%)"
            value={ratePercent}
            onChange={(event) => setRatePercent(event.target.value)}
            inputMode="decimal"
            fieldSize="md"
            suffix="%"
          />
          <AmountField
            id="lend-duration"
            label="Duration (days)"
            defaultValue="30"
            inputMode="numeric"
            fieldSize="md"
            suffix="d"
          />
        </div>
        <SealedHint message="Your bid rate is sealed — only the matching engine sees it, never rival lenders. Canton privacy, not encryption." />
        {placeBid.isError ? (
          <p className="text-sm text-danger">{placeBid.error?.message}</p>
        ) : null}
        <Button fullWidth onClick={handleSubmit} disabled={placeBid.isPending}>
          {placeBid.isPending ? "Submitting..." : "Submit Sealed Bid"}
        </Button>
      </Card>

      <section className="mt-8" data-tour="lend-bids">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          My sealed bids
        </h2>
        <QueryState
          isLoading={bids.isLoading}
          isError={bids.isError}
          isEmpty={!bids.data || bids.data.length === 0}
          errorMessage="Could not load your bids."
          emptyMessage="No bids yet. Submit a sealed bid to get started."
        >
          <ul className="space-y-3">
            {bids.data?.map((bid) => (
              <li key={bid.bidId}>
                <TxRow
                  symbol="nUSD"
                  title={`${formatAmount(bid.amount)} at ${formatRate(bid.rate)}`}
                  subtitle={`Sealed bid - ${bid.lender}`}
                  idLabel={bid.bidId}
                  status={bid.status}
                  statusTone={bid.status === "MATCHED" ? "success" : "accent"}
                />
              </li>
            ))}
          </ul>
        </QueryState>
      </section>
    </div>
  );
}
