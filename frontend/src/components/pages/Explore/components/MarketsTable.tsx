"use client";

import { Check, Copy, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { QueryState } from "@/components/shared/QueryState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useAppConfig, useMarket } from "@/lib/api/hooks";
import { formatAmount } from "@/lib/format";

const shortPkg = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;

export function MarketsTable() {
  const market = useMarket();
  const config = useAppConfig();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    const list = market.data?.instruments ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => i.instrument.toLowerCase().includes(q));
  }, [market.data, query]);

  const pkg = config.data?.packageId ?? "";
  const copyPkg = async () => {
    if (!pkg) return;
    try {
      await navigator.clipboard.writeText(pkg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Markets
        </h2>
        <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search market or symbol"
            className="w-44 bg-transparent text-foreground outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <Card className="overflow-x-auto p-0">
        <QueryState
          isLoading={market.isLoading}
          isError={market.isError}
          isEmpty={rows.length === 0}
          errorMessage="Could not load markets."
          emptyMessage="No markets match your search."
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Lend Intents</th>
                <th className="px-5 py-3 font-semibold">Borrow Intents</th>
                <th className="px-5 py-3 font-semibold">Open Volume</th>
                <th className="px-5 py-3 font-semibold">Active Loans</th>
                <th className="px-5 py-3 font-semibold">Network</th>
                <th className="px-5 py-3 font-semibold">Contract</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr
                  key={m.instrument}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-5 py-4 text-muted">{i + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol="nUSD" size={30} />
                      <div>
                        <p className="font-semibold text-foreground">
                          Nelva {m.instrument}
                        </p>
                        <p className="text-xs text-muted">n{m.instrument}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-success">
                    {m.openBids}
                  </td>
                  <td className="px-5 py-4 font-semibold text-foreground">
                    {m.openBorrows}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {m.totalOpenLendVolume !== null
                      ? formatAmount(m.totalOpenLendVolume)
                      : "private"}
                  </td>
                  <td className="px-5 py-4 text-foreground">{m.activeLoans}</td>
                  <td className="px-5 py-4">
                    <Badge tone="accent">Canton DevNet</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={copyPkg}
                      title={`${pkg} — click to copy the Daml package id`}
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted transition-colors hover:text-foreground"
                    >
                      {pkg ? shortPkg(pkg) : "…"}
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
      <p className="mt-2 text-xs text-muted">
        Volumes backed by fewer than two distinct parties show as
        &quot;private&quot; — Canton never leaks a single participant&apos;s
        position.
      </p>
    </section>
  );
}
