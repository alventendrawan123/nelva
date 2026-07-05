"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortParty } from "@/lib/format";

export function WalletAddressMenu({ partyId }: { partyId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(partyId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        title={partyId}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
      >
        {shortParty(partyId)}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ChevronDown className="h-4 w-4 text-muted" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-card"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Wallet address
            </p>
            <p className="mt-2 break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs text-foreground">
              {partyId}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wallet px-4 py-2 text-sm font-semibold text-wallet-foreground transition-opacity hover:opacity-90"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied"
                    initial={
                      prefersReducedMotion ? false : { scale: 0.7, opacity: 0 }
                    }
                    animate={{ scale: 1, opacity: 1 }}
                    exit={
                      prefersReducedMotion
                        ? undefined
                        : { scale: 0.7, opacity: 0 }
                    }
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Copied
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={
                      prefersReducedMotion ? false : { scale: 0.7, opacity: 0 }
                    }
                    animate={{ scale: 1, opacity: 1 }}
                    exit={
                      prefersReducedMotion
                        ? undefined
                        : { scale: 0.7, opacity: 0 }
                    }
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy address
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
