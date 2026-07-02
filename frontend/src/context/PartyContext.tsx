"use client";

import { createContext, useContext, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";

// The connected wallet is the sole identity (single-user, connect-first). `party`
// is the connected party id, or undefined when disconnected.
type PartyContextValue = { party: string | undefined };

const PartyContext = createContext<PartyContextValue | null>(null);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const { partyId } = useWallet();
  const value = useMemo<PartyContextValue>(
    () => ({ party: partyId ?? undefined }),
    [partyId],
  );
  return (
    <PartyContext.Provider value={value}>{children}</PartyContext.Provider>
  );
}

export function useParty(): PartyContextValue {
  const context = useContext(PartyContext);
  if (!context) {
    throw new Error("useParty must be used within a PartyProvider");
  }
  return context;
}
