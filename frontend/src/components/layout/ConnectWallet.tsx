"use client";

import { WalletAddressMenu } from "@/components/layout/WalletAddressMenu";
import { useWallet } from "@/context/WalletContext";
import { useFaucet, useHoldings } from "@/lib/api/hooks";

export function ConnectWallet() {
  const {
    partyId,
    connecting,
    error,
    cantonEnabled,
    connect,
    connectCanton,
    disconnect,
  } = useWallet();
  const faucet = useFaucet();
  const holdings = useHoldings();
  const available = holdings.data
    ? holdings.data
        .filter((h) => !h.locked)
        .reduce((total, h) => total + h.amount, 0)
    : null;

  if (!partyId) {
    // when a hosted Canton gateway is configured, offer the real CIP-0103 wallet
    // plus the instant in-browser demo wallet; otherwise just the demo wallet.
    if (cantonEnabled) {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-tour="connect-wallet"
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
        data-tour="connect-wallet"
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
          {available.toLocaleString("en-US")}{" "}
          <span className="ml-1 text-muted">nUSD</span>
        </span>
      ) : null}
      <button
        type="button"
        data-tour="faucet"
        onClick={() => faucet.mutate()}
        disabled={faucet.isPending}
        className="rounded-full bg-wallet px-3 py-1.5 text-sm font-semibold text-wallet-foreground disabled:opacity-60"
        title="Get test nUSD"
      >
        {faucet.isPending ? "…" : "Faucet"}
      </button>
      <WalletAddressMenu partyId={partyId} />
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
