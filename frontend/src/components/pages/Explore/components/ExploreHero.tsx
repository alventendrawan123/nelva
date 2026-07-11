import Image from "next/image";
import { Card } from "@/components/ui/Card";

// Pure hero — the live market totals live in the Public-Market panel below, so
// they aren't duplicated here.
export function ExploreHero() {
  return (
    <Card className="relative overflow-hidden p-8 sm:p-10">
      <div className="relative z-10 max-w-xl">
        <h1 className="text-4xl font-bold text-foreground">
          Explore Nelva markets
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Browse private lending and borrowing markets. Rates stay sealed and
          settle inside Nelva&apos;s deterministic, auditable matching engine —
          the totals here are read live from the Canton ledger.
        </p>
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
