"use client";

import { TokenIcon } from "@/components/ui/TokenIcon";
import { useMyBids, useMyBorrows } from "@/lib/api/hooks";

const STARTING_BALANCE = 1000;
const LOCKED_BID_STATUSES = ["OPEN", "MATCHED"];
const LOCKED_BORROW_STATUSES = ["OPEN", "MATCHED"];

export function BalancePill() {
  const bids = useMyBids();
  const borrows = useMyBorrows();

  const lockedInBids = (bids.data ?? [])
    .filter((bid) => LOCKED_BID_STATUSES.includes(bid.status))
    .reduce((total, bid) => total + bid.amount, 0);

  const lockedInCollateral = (borrows.data ?? [])
    .filter((borrow) => LOCKED_BORROW_STATUSES.includes(borrow.status))
    .reduce((total, borrow) => total + borrow.collateralAmount, 0);

  const balance = Math.max(
    0,
    STARTING_BALANCE - lockedInBids - lockedInCollateral,
  );

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground">
      <TokenIcon symbol="nUSD" size={20} />
      {balance.toLocaleString("en-US")}
      <span className="text-muted">nUSD</span>
    </span>
  );
}
