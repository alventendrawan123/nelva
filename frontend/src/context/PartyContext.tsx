"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { PERSONA_PARTY, type Persona } from "@/config/nav";
import { useWallet } from "@/context/WalletContext";

type PartyContextValue = {
  persona: Persona;
  party: string | undefined;
  setPersona: (persona: Persona) => void;
};

const PartyContext = createContext<PartyContextValue | null>(null);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona>("Lender A");
  const { partyId } = useWallet();

  const value = useMemo<PartyContextValue>(
    // a connected wallet is the identity; otherwise fall back to the demo persona
    () => ({ persona, party: partyId ?? PERSONA_PARTY[persona], setPersona }),
    [persona, partyId],
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
