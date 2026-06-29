"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { PERSONA_PARTY, type Persona } from "@/config/nav";

type PartyContextValue = {
  persona: Persona;
  party: string | undefined;
  setPersona: (persona: Persona) => void;
};

const PartyContext = createContext<PartyContextValue | null>(null);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona>("Lender");

  const value = useMemo<PartyContextValue>(
    () => ({ persona, party: PERSONA_PARTY[persona], setPersona }),
    [persona],
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
