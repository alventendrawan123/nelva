"use client";

import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { useMarket } from "@/lib/api/hooks";

export function ExploreHero() {
  const market = useMarket();
  const instruments = market.data?.instruments ?? [];
  const stats = [
    { label: "Markets Available", value: instruments.length },
    {
      label: "Active Lend Intents",
      value: instruments.reduce((s, m) => s + m.openBids, 0),
    },
    {
      label: "Active Borrow Intents",
      value: instruments.reduce((s, m) => s + m.openBorrows, 0),
    },
  ];

  return (
    <Card className="relative overflow-hidden p-8 sm:p-10">
      <div className="relative z-10 max-w-xl">
        <h1 className="text-4xl font-bold text-foreground">
          Explore Nelva markets
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Browse private lending and borrowing markets. Rates stay sealed and
          settle inside Nelva&apos;s deterministic, auditable matching engine —
          the totals below are read live from the Canton ledger.
        </p>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="text-3xl font-bold text-foreground">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <Image
        src="/assets/images/logo/nelva-logo.png"
        alt=""
        width={260}
        height={260}
        aria-hidden
        className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 opacity-30 blur-[1px] lg:block"
      />
    </Card>
  );
}
