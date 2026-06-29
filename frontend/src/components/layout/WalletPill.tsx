"use client";

import { useParty } from "@/context/PartyContext";
import { useMe } from "@/lib/api/hooks";

// Canton party-id looks like "LenderA::1220c2e6...d511". Show name + short fingerprint.
function shortPartyId(id: string): string {
  const [name, fingerprint] = id.split("::");
  if (!fingerprint) return id;
  return `${name}::${fingerprint.slice(0, 8)}…`;
}

export function WalletPill() {
  const { party } = useParty();
  const me = useMe();

  const label = !party
    ? "Outsider"
    : me.data?.partyId
      ? shortPartyId(me.data.partyId)
      : party;

  return (
    <span
      className="rounded-full bg-wallet px-4 py-2 text-sm font-semibold text-wallet-foreground"
      title={me.data?.partyId ?? party ?? "No party"}
    >
      {label}
    </span>
  );
}
