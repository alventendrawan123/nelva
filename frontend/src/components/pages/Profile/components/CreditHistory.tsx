"use client";

import { Card } from "@/components/ui/Card";
import { useProfile } from "@/lib/api/hooks";
import { formatAmount, formatRate } from "@/lib/format";

export function CreditHistory() {
  const { loans } = useProfile();
  const settled = loans.filter((loan) => loan.status !== "ACTIVE");

  return (
    <Card className="flex flex-col p-6">
      <h2 className="mb-6 text-lg font-bold text-foreground">Credit History</h2>
      {settled.length > 0 ? (
        <ul className="space-y-3">
          {settled.map((loan) => (
            <li
              key={loan.loanId}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted">
                {formatAmount(loan.principal)} at {formatRate(loan.blendedRate)}
              </span>
              <span className="font-semibold text-foreground">
                {loan.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted">
          No loan history yet.
        </div>
      )}
    </Card>
  );
}
