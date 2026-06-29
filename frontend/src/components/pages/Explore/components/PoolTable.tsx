import { TokenChip } from "@/components/ui/TokenChip";
import { POOLS } from "@/lib/mock/pools";

const COLUMNS = [
  "#",
  "Name",
  "Open Bids",
  "Borrow Intents",
  "Network",
  "Contract",
] as const;

export function PoolTable() {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            {COLUMNS.map((column) => (
              <th key={column} className="px-5 py-4 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POOLS.map((pool, index) => (
            <tr key={pool.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 text-muted">{index + 1}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <TokenChip symbol={pool.symbol} showChevron={false} />
                  <div>
                    <p className="font-semibold text-foreground">{pool.name}</p>
                    <p className="text-xs text-muted">{pool.symbol}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-success">{pool.openBids}</td>
              <td className="px-5 py-4 text-foreground">
                {pool.borrowIntents}
              </td>
              <td className="px-5 py-4 text-foreground">{pool.network}</td>
              <td className="px-5 py-4 font-mono text-xs text-muted">
                {pool.contract}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
