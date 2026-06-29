import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TokenChip } from "@/components/ui/TokenChip";
import { POOLS } from "@/lib/mock/pools";

export function FeaturedPools() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <Badge tone="neutral">Featured Pools</Badge>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous pools"
            className="rounded-full border border-border p-2 text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next pools"
            className="rounded-full border border-border p-2 text-muted transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {POOLS.map((pool) => (
          <Card key={pool.id} className="p-5">
            <div className="flex items-center gap-3">
              <TokenChip symbol={pool.symbol} showChevron={false} />
              <div>
                <p className="font-semibold text-foreground">{pool.name}</p>
                <p className="text-sm text-muted">{pool.symbol}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge tone="success">{pool.status} Pool</Badge>
              <span className="text-sm text-muted">{pool.network}</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
