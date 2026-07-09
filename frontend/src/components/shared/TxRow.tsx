"use client";

import { type ReactNode, useState } from "react";
import { FiExternalLink } from "react-icons/fi";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api/endpoints";
import { shortId } from "@/lib/format";

type BadgeTone = "success" | "danger" | "warning" | "accent" | "neutral";

type TxRowProps = {
  symbol: string;
  title: string;
  subtitle: string;
  idLabel?: string;
  status: string;
  statusTone?: BadgeTone;
  trailing?: ReactNode;
  /** ledger offset of the tx that created this contract — makes the ↗ icon open
   *  that transaction in the Nelva Explorer (live ledger view). */
  txOffset?: number;
};

export function TxRow({
  symbol,
  title,
  subtitle,
  idLabel,
  status,
  statusTone = "accent",
  trailing,
  txOffset,
}: TxRowProps) {
  const { showError } = useFeedback();
  const [busy, setBusy] = useState(false);

  // resolve this row's creating tx and open it in the Nelva Explorer (live ledger view)
  const openExplorer = async () => {
    if (!txOffset || busy) return;
    setBusy(true);
    try {
      const { updateId } = await api.txByOffset(txOffset);
      window.open(`/tx/${updateId}`, "_blank", "noopener");
    } catch (e) {
      showError(
        e instanceof Error ? e.message : "Could not fetch the tx hash.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors duration-200 hover:border-border-strong">
      <TokenIcon symbol={symbol} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{subtitle}</span>
          {idLabel ? (
            <span
              title={idLabel}
              className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
            >
              {shortId(idLabel)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <Badge tone={statusTone}>{status}</Badge>
        {txOffset ? (
          <button
            type="button"
            onClick={openExplorer}
            disabled={busy}
            title="View this contract's on-ledger transaction"
            aria-label="View on-ledger transaction"
            className="rounded p-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            <FiExternalLink className="h-4 w-4" />
          </button>
        ) : (
          <FiExternalLink className="h-4 w-4 text-muted" aria-hidden />
        )}
      </div>
    </div>
  );
}
