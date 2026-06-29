"use client";

import { TxRow } from "@/components/shared/TxRow";
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
            <li key={loan.loanId}>
              <TxRow
                symbol="nUSD"
                title={`${formatAmount(loan.principal)} at ${formatRate(loan.blendedRate)}`}
                subtitle={`Collateral ${formatAmount(loan.collateralAmount)}`}
                idLabel={loan.loanId}
                status={loan.status}
                statusTone="accent"
              />
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
