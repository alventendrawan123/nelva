"use client";

import { Eye, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useStatus } from "@/lib/api/hooks";

// The OUTSIDER perspective, made explicit on the public page: everything here is
// aggregate, read live from the Canton ledger. It's the same "outsider" slice the
// five-perspective lens shows — surfaced where an outsider actually lands.
export function OutsiderView() {
  const status = useStatus();

  const stats = [
    { label: "Open bids", value: status.data?.openBids ?? 0 },
    { label: "Active loans", value: status.data?.activeLoans ?? 0 },
    { label: "Match proposals", value: status.data?.proposals ?? 0 },
  ];

  const hidden = [
    "Individual rates",
    "Party identities",
    "Amounts per party",
    "Who matched whom",
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-px bg-border sm:grid-cols-[1.1fr_1fr]">
        {/* left: the framing */}
        <div className="bg-surface p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <Eye className="h-3.5 w-3.5" />
            Outsider view
          </span>
          <h2 className="mt-4 text-2xl font-bold text-foreground">
            What everyone outside the deal sees
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            This is the outsider&apos;s projection, read live from the Canton
            ledger — aggregates only. Every rate stays sealed to its party, and
            no rival ever learns who matched whom. Privacy holds for everyone
            outside the deal.
          </p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
            Hidden from you
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted"
              >
                <Lock className="h-3 w-3" />
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* right: the aggregates the outsider CAN see */}
        <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-1">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col justify-center bg-surface p-6 text-center sm:flex-row sm:items-baseline sm:justify-between sm:text-left"
            >
              <span className="text-xs uppercase tracking-wide text-muted">
                {s.label}
              </span>
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
