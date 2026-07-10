"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { loadTxLog, subscribeTxLog, type TxEntry } from "@/lib/txlog";

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// useSyncExternalStore needs a stable snapshot; cache by the serialized value.
let cache: { raw: string; list: TxEntry[] } = { raw: "", list: [] };
function snapshot(): TxEntry[] {
  const list = loadTxLog();
  const raw = JSON.stringify(list);
  if (raw !== cache.raw) cache = { raw, list };
  return cache.list;
}
const empty: TxEntry[] = [];

/** Navbar button (↗) listing every wallet action's on-ledger tx hash — click an entry to copy it. */
export function TxHistory() {
  const [open, setOpen] = useState(false);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const entries = useSyncExternalStore(subscribeTxLog, snapshot, () => empty);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!copiedTx) return;
    const timer = setTimeout(() => setCopiedTx(null), 1600);
    return () => clearTimeout(timer);
  }, [copiedTx]);

  const handleCopy = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTx(txId);
    } catch {
      setCopiedTx(null);
    }
  };

  const count = useMemo(() => entries.length, [entries]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        title="On-ledger transactions"
        data-tour="tx-history"
        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
      >
        <ArrowUpRight className="h-4 w-4 text-muted" />
        Transaction history
        {count > 0 ? (
          <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-muted">
            {count}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-border bg-surface p-2 shadow-xl"
            role="dialog"
            aria-label="Recent on-ledger transactions"
          >
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
              On-ledger transactions
            </p>
            {entries.length === 0 ? (
              <p className="px-2 pb-2 text-sm text-muted">
                No transactions yet — every action you sign lands here with its
                Canton tx hash.
              </p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {entries.map((e) => (
                  <li key={`${e.txId}-${e.at}`}>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/tx/${e.txId}`, "_blank", "noopener")
                      }
                      title={`${e.txId} — click to view in the explorer`}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {e.label}
                        </p>
                        <p className="font-mono text-[11px] text-muted">
                          {shortHash(e.txId)} · {timeOf(e.at)}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Copy tx hash"
                        title="Copy tx hash"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void handleCopy(e.txId);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.stopPropagation();
                            void handleCopy(e.txId);
                          }
                        }}
                        className="rounded p-0.5 text-muted transition-colors hover:text-foreground"
                      >
                        {copiedTx === e.txId ? (
                          <Check className="h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <Copy className="h-4 w-4 shrink-0 text-muted" />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
