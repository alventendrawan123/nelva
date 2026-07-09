"use client";

// Nelva Explorer — live view of one committed Canton transaction, read straight
// from the ledger (stakeholder view). Canton has no public Etherscan for app
// transactions by design: explorers like Cantonscan only see Canton-Coin/DSO
// activity, never a private app's sub-transactions. The app itself is the
// explorer for the parties entitled to see them.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/endpoints";
import type { TxEvent } from "@/lib/api/schemas";

const mono = "font-mono text-[12px] break-all";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded p-1 text-muted transition-colors hover:text-foreground"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function EventCard({ event }: { event: TxEvent }) {
  const created = event.kind === "created";
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={created ? "success" : "warning"}>
          {created ? "CONTRACT CREATED" : "CONTRACT ARCHIVED"}
        </Badge>
        <span className="font-semibold text-foreground">{event.template}</span>
        {event.packageName ? (
          <span className="text-xs text-muted">({event.packageName})</span>
        ) : null}
      </div>
      {event.contractId ? (
        <div className="flex items-center gap-1">
          <p className={`${mono} text-muted`} title={event.contractId}>
            {event.contractId}
          </p>
          <CopyButton value={event.contractId} />
        </div>
      ) : null}
      {created && event.argument !== undefined ? (
        <div className="overflow-x-auto rounded-xl bg-surface-2 p-3">
          <pre className="text-[12px] leading-relaxed text-muted">
            {JSON.stringify(event.argument, null, 2)}
          </pre>
        </div>
      ) : null}
      {created && (event.signatories?.length || event.observers?.length) ? (
        <div className="space-y-1 text-xs text-muted">
          {event.signatories?.length ? (
            <p>
              <span className="font-semibold text-foreground">
                Signatories:
              </span>{" "}
              {event.signatories.join(", ")}
            </p>
          ) : null}
          {event.observers?.length ? (
            <p>
              <span className="font-semibold text-foreground">Observers:</span>{" "}
              {event.observers.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function TxPage({
  params,
}: {
  params: Promise<{ updateId: string }>;
}) {
  const { updateId } = use(params);
  const tx = useQuery({
    queryKey: ["tx", updateId],
    queryFn: () => api.txDetails(updateId),
    retry: 2,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Nelva
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Transaction</h1>
      <p className="mt-1 text-sm text-muted">
        Read live from the Canton ledger — this is the committed transaction,
        not an app-side record.
      </p>

      <Card className="mt-6 space-y-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Update ID (tx hash)
          </p>
          <div className="mt-1 flex items-center gap-1">
            <p className={`${mono} text-foreground`}>{updateId}</p>
            <CopyButton value={updateId} />
          </div>
        </div>

        {tx.isLoading ? (
          <p className="text-sm text-muted">Reading the ledger…</p>
        ) : null}
        {tx.isError ? (
          <p className="text-sm text-danger">
            {tx.error instanceof Error
              ? tx.error.message
              : "Could not load this transaction."}
          </p>
        ) : null}

        {tx.data ? (
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Status</p>
              <Badge tone="success">COMMITTED</Badge>
            </div>
            <div>
              <p className="text-xs text-muted">Ledger offset</p>
              <p className="font-semibold text-foreground">{tx.data.offset}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Effective at</p>
              <p className="font-semibold text-foreground">
                {new Date(tx.data.effectiveAt).toLocaleString()}
              </p>
            </div>
            {tx.data.synchronizerId ? (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-muted">Synchronizer</p>
                <p className={`${mono} text-muted`}>{tx.data.synchronizerId}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {tx.data ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-foreground">
            Events ({tx.data.events.length})
          </h2>
          <div className="space-y-3">
            {tx.data.events.map((event, i) => (
              <EventCard key={`${event.contractId ?? i}`} event={event} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
