"use client";

// Nelva Explorer — address page: every on-ledger transaction a party is a
// stakeholder in, read live from the Canton ledger. The Etherscan address-page
// equivalent, served by a node entitled to see these transactions (Canton's
// privacy keeps them off public explorers by design).
//
// Static route + ?party= query (not a dynamic segment): the /address/[party]
// serverless function 500'd on Vercel while the same build ran clean locally,
// so this page uses the same static-shell pattern as /explore instead.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/endpoints";

const mono = "font-mono text-[12px] break-all";
const shortHash = (h: string) => `${h.slice(0, 14)}…${h.slice(-6)}`;

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

function AddressView() {
  const party = useSearchParams().get("party") ?? "";
  const history = useQuery({
    queryKey: ["address-txs", party],
    queryFn: () => api.addressTxs(party),
    enabled: Boolean(party),
    retry: 2,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/profile"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Profile
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Address</h1>
      <p className="mt-1 text-sm text-muted">
        Every on-ledger transaction this party is a stakeholder in — read live
        from the Canton ledger.
      </p>

      <Card className="mt-6 space-y-2 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Party ID
        </p>
        <div className="flex items-center gap-1">
          <p className={`${mono} text-foreground`}>{party || "—"}</p>
          {party ? <CopyButton value={party} /> : null}
        </div>
        {history.data ? (
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {history.data.count}
            </span>{" "}
            transaction{history.data.count === 1 ? "" : "s"} on ledger
          </p>
        ) : null}
      </Card>

      {history.isLoading && party ? (
        <p className="mt-6 text-sm text-muted">Reading the ledger…</p>
      ) : null}
      {history.isError ? (
        <p className="mt-6 text-sm text-danger">
          {history.error instanceof Error
            ? history.error.message
            : "Could not load this address."}
        </p>
      ) : null}

      {history.data ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-foreground">
            Transactions
          </h2>
          <ul className="space-y-2">
            {history.data.txs.map((tx) => (
              <li key={tx.updateId}>
                <Link
                  href={`/tx/${tx.updateId}`}
                  className="flex flex-col gap-1 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`${mono} text-foreground`}>
                      {shortHash(tx.updateId)}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(tx.effectiveAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tx.events.slice(0, 4).map((e, i) => (
                      <Badge
                        key={`${tx.updateId}-${i}`}
                        tone={e.kind === "created" ? "success" : "warning"}
                      >
                        {e.kind === "created" ? "＋" : "－"}{" "}
                        {(e.template ?? "").split(":").pop()}
                      </Badge>
                    ))}
                    {tx.events.length > 4 ? (
                      <span className="text-xs text-muted">
                        +{tx.events.length - 4} more
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export default function AddressPage() {
  return (
    <Suspense fallback={null}>
      <AddressView />
    </Suspense>
  );
}
