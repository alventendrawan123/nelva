"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useProfile } from "@/lib/api/hooks";
import { formatAmount, formatRate } from "@/lib/format";

export function PositionsList() {
  const { loans } = useProfile();
  const active = loans.filter((loan) => loan.status === "ACTIVE");

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-bold text-foreground">Your Positions</h2>
      {active.length > 0 ? (
        <ul className="space-y-3">
          {active.map((loan) => (
            <li
              key={loan.loanId}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 p-4"
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
              <Badge tone="accent">{loan.status}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No active positions. Start lending or borrowing to see them here.
        </p>
      )}
    </Card>
  );
}
