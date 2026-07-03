"use client";

import { TxRow } from "@/components/shared/TxRow";
import { Card } from "@/components/ui/Card";
import { useLenderStatus, useProfile } from "@/lib/api/hooks";
import { formatAmount, formatRate } from "@/lib/format";

export function PositionsList() {
  const { loans } = useProfile();
  const lender = useLenderStatus();

  const borrowerLoans = loans.filter((loan) => loan.status === "ACTIVE");
  const lenderPositions = lender.data?.activeLoans ?? [];
  const hasAny = borrowerLoans.length > 0 || lenderPositions.length > 0;

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-bold text-foreground">Your Positions</h2>
      {hasAny ? (
        <ul className="space-y-3">
          {lenderPositions.map((position) => (
            <li key={position.loanId}>
              <TxRow
                symbol="nUSD"
                title={`Lent ${formatAmount(position.myPrincipal)} at ${formatRate(position.myRate)}`}
                subtitle={`To ${position.borrower} - owed ${formatAmount(position.owedToMe)}`}
                idLabel={position.loanId}
                status="LENDING"
                statusTone="success"
              />
            </li>
          ))}
          {borrowerLoans.map((loan) => (
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
      {lenderPositions.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          You see only your own rate. Co-lenders' rates on the same loan stay
          hidden - privacy enforced by Canton, not the UI.
        </p>
      ) : null}
    </Card>
  );
}
