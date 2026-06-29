"use client";

import { QueryState } from "@/components/shared/QueryState";
import { TxRow } from "@/components/shared/TxRow";
import { StatTile } from "@/components/ui/StatTile";
import { useLoans, useStatus } from "@/lib/api/hooks";
import { formatAmount, formatRate } from "@/lib/format";
import { PanelHeading } from "./PanelHeading";

export function StatusPanel() {
  const status = useStatus();
  const loans = useLoans();

  return (
    <div className="mx-auto max-w-2xl">
      <PanelHeading
        title="Your positions"
        description="Track public market activity and your own active loans in real time."
      />

      <QueryState
        isLoading={status.isLoading}
        isError={status.isError}
        errorMessage="Could not load market status."
      >
        <div className="grid grid-cols-3 gap-4" data-tour="status-stats">
          <StatTile label="Open Bids" value={status.data?.openBids ?? 0} />
          <StatTile
            label="Active Loans"
            value={status.data?.activeLoans ?? 0}
          />
          <StatTile label="Proposals" value={status.data?.proposals ?? 0} />
        </div>
      </QueryState>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          Active positions
        </h2>
        <QueryState
          isLoading={loans.isLoading}
          isError={loans.isError}
          isEmpty={!loans.data || loans.data.length === 0}
          errorMessage="Could not load your positions."
          emptyMessage="No active intents or loans found."
        >
          <ul className="space-y-3">
            {loans.data?.map((loan) => (
              <li key={loan.loanId}>
                <TxRow
                  symbol="nUSD"
                  title={`${formatAmount(loan.principal)} at ${formatRate(loan.blendedRate)}`}
                  subtitle={`Loan - ${loan.borrower}`}
                  idLabel={loan.loanId}
                  status={loan.status}
                  statusTone={loan.status === "ACTIVE" ? "accent" : "success"}
                />
              </li>
            ))}
          </ul>
        </QueryState>
      </section>
    </div>
  );
}
