"use client";

import { QueryState } from "@/components/shared/QueryState";
import { Card } from "@/components/ui/Card";
import { useHoldings } from "@/lib/api/hooks";
import { formatAmount } from "@/lib/format";

export function PrivateWallet() {
  const holdings = useHoldings();
  const rows = holdings.data ?? [];

  return (
    <Card className="flex flex-col p-6">
      <h2 className="mb-6 text-lg font-bold text-foreground">Private Wallet</h2>
      <p className="-mt-4 mb-4 text-xs text-muted">
        Your on-ledger holdings. Only you can see these — Canton scopes every
        read to the requesting party.
      </p>
      <QueryState
        isLoading={holdings.isLoading}
        isError={holdings.isError}
        isEmpty={rows.length === 0}
        errorMessage="Could not load holdings."
        emptyMessage="No holdings on the ledger yet."
      >
        <ul className="nelva-scroll max-h-80 w-full space-y-2 overflow-y-auto pr-1">
          {rows.map((holding, index) => (
            <li
              key={`${holding.instrument}-${holding.locked}-${index}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm"
            >
              <span className="text-muted">
                {holding.instrument}
                {holding.locked ? " · locked" : ""}
              </span>
              <span className="font-semibold text-foreground">
                {formatAmount(holding.amount)}
              </span>
            </li>
          ))}
        </ul>
      </QueryState>
    </Card>
  );
}
