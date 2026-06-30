"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { useWallet } from "@/context/WalletContext";

function shortId(id: string): string {
  const [name, fingerprint] = id.split("::");
  return fingerprint ? `${name}::${fingerprint.slice(0, 8)}…` : id;
}

export function ConnectWallet() {
  const { partyId, connecting, error, cantonEnabled, connect, connectCanton, disconnect } =
    useWallet();
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!partyId) {
      setAvailable(null);
      return;
    }
    let live = true;
    fetch(`${API_BASE_URL}/holdings`, { headers: { Authorization: `Bearer ${partyId}` } })
      .then((r) => r.json())
      .then((rows: { amount: number; locked: boolean }[]) => {
        if (!live || !Array.isArray(rows)) return;
        setAvailable(rows.filter((h) => !h.locked).reduce((t, h) => t + h.amount, 0));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [partyId]);

  if (!partyId) {
    // when a hosted Canton gateway is configured, offer the real CIP-0103 wallet
    // plus the instant in-browser demo wallet; otherwise just the demo wallet.
    if (cantonEnabled) {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => connectCanton()}
            disabled={connecting}
            className="rounded-full bg-wallet px-4 py-2 text-sm font-semibold text-wallet-foreground disabled:opacity-60"
            title={error ?? "Connect your Canton wallet"}
          >
            {connecting ? "Connecting…" : "Connect Canton Wallet"}
          </button>
          <button
            type="button"
            onClick={() => connect()}
            disabled={connecting}
            className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60"
            title="Instant in-browser demo wallet — no setup"
          >
            Quick wallet
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => connect()}
        disabled={connecting}
        className="rounded-full bg-wallet px-4 py-2 text-sm font-semibold text-wallet-foreground disabled:opacity-60"
        title={error ?? undefined}
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {available !== null ? (
        <span className="hidden items-center rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground sm:inline-flex">
          {available.toLocaleString("en-US")} <span className="ml-1 text-muted">nUSD</span>
        </span>
      ) : null}
      <span
        className="rounded-full bg-wallet px-3 py-1.5 text-sm font-semibold text-wallet-foreground"
        title={partyId}
      >
        {shortId(partyId)}
      </span>
      <button
        type="button"
        onClick={disconnect}
        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
      >
        Disconnect
      </button>
    </div>
  );
}
