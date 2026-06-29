"use client";

import { TokenIcon } from "@/components/ui/TokenIcon";
import { useHoldings } from "@/lib/api/hooks";

export function BalancePill() {
  const holdings = useHoldings();
  const rows = holdings.data ?? [];

  const available = rows
    .filter((holding) => !holding.locked)
    .reduce((total, holding) => total + holding.amount, 0);
  const locked = rows
    .filter((holding) => holding.locked)
    .reduce((total, holding) => total + holding.amount, 0);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground"
      title={
        locked > 0
          ? `${locked.toLocaleString("en-US")} nUSD locked on the ledger`
          : "On-ledger balance"
      }
    >
      <TokenIcon symbol="nUSD" size={20} />
      {available.toLocaleString("en-US")}
      <span className="text-muted">nUSD</span>
    </span>
  );
}
