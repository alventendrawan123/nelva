"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useBadgeStats, useMarket } from "@/lib/api/hooks";

export function FeaturedMarkets() {
  const market = useMarket();
  const badges = useBadgeStats();
  const instruments = market.data?.instruments ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Featured markets
        </h2>
        {badges.data && badges.data.total > 0 ? (
          <p className="text-xs text-muted">
            Audit verdicts:{" "}
            <span className="font-semibold text-success">
              {badges.data.green} GREEN
            </span>
            {" · "}
            <span className="font-semibold text-danger">
              {badges.data.red} RED
            </span>{" "}
            — every match re-verified on-ledger
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {instruments.map((m) => (
          <Card key={m.instrument} className="flex items-center gap-4 p-5">
            <TokenIcon symbol="nUSD" size={42} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">Nelva {m.instrument}</p>
              <p className="text-xs text-muted">n{m.instrument}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="success">Active Market</Badge>
                <Badge tone="neutral">Canton DevNet</Badge>
              </div>
            </div>
            <div className="text-right text-xs text-muted">
              <p>
                <span className="font-semibold text-foreground">
                  {m.openBids}
                </span>{" "}
                lends
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  {m.openBorrows}
                </span>{" "}
                borrows
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  {m.activeLoans}
                </span>{" "}
                loans
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
