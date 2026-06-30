"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { connectWallet, wallet } from "@/lib/wallet/client";

type WalletValue = {
  partyId: string | null;
  connecting: boolean;
  error: string | null;
  connect: (hint?: string) => Promise<void>;
  disconnect: () => void;
};

const WalletCtx = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hydrate from localStorage on the client (avoids SSR mismatch)
  useEffect(() => {
    setPartyId(wallet.party());
  }, []);

  const connect = useCallback(async (hint = "User") => {
    setConnecting(true);
    setError(null);
    try {
      setPartyId(await connectWallet(hint));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    wallet.disconnect();
    setPartyId(null);
  }, []);

  return (
    <WalletCtx.Provider value={{ partyId, connecting, error, connect, disconnect }}>
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
