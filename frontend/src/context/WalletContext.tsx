"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { API_BASE_URL } from "@/config/env";
import {
  cantonWalletEnabled,
  connectCantonWallet,
  disconnectCantonWallet,
  restoreCantonWallet,
} from "@/lib/wallet/canton";
import { connectWallet, wallet } from "@/lib/wallet/client";
import {
  clearActiveWallet,
  getWalletKind,
  setCantonActive,
  setEmbeddedActive,
} from "@/lib/wallet/walletMode";

type WalletValue = {
  partyId: string | null;
  connecting: boolean;
  error: string | null;
  cantonEnabled: boolean;
  connect: (hint?: string) => Promise<void>;
  connectCanton: () => Promise<void>;
  disconnect: () => void;
};

const WalletCtx = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hydrate from the persisted choice. Embedded re-attaches a localStorage key;
  // Canton re-attaches a gateway session (no picker). Disconnected stays so.
  useEffect(() => {
    if (getWalletKind() === "canton") {
      restoreCantonWallet()
        .then((p) => {
          if (p) {
            setCantonActive(p);
            setPartyId(p);
          }
        })
        .catch(() => {});
    } else {
      setPartyId(wallet.isSessionActive() ? wallet.party() : null);
    }
  }, []);

  const connect = useCallback(async (hint = "User") => {
    setConnecting(true);
    setError(null);
    try {
      const p = await connectWallet(hint);
      setEmbeddedActive();
      setPartyId(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectCanton = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const p = await connectCantonWallet();
      setCantonActive(p);
      // a fresh gateway party has no funds — top it up once so it can transact
      await fetch(`${API_BASE_URL}/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party: p }),
      }).catch(() => {});
      setPartyId(p);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not connect Canton wallet.",
      );
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (getWalletKind() === "canton") {
      void disconnectCantonWallet();
    } else {
      wallet.endSession();
    }
    clearActiveWallet();
    setPartyId(null);
  }, []);

  return (
    <WalletCtx.Provider
      value={{
        partyId,
        connecting,
        error,
        cantonEnabled: cantonWalletEnabled(),
        connect,
        connectCanton,
        disconnect,
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
