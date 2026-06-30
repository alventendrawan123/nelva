"use client";
// Which wallet transport is active, and the active party id.
//   - "embedded": browser-held Ed25519 key + BE relay (keyholder.ts / client.ts).
//   - "canton":   real CIP-0103 wallet via the hosted gateway (canton.ts).
// Persisted so the choice + party survive reloads. The submit dispatch and the
// command builders read this to route to the right transport / party.
import { wallet } from "./keyholder";

export type WalletKind = "embedded" | "canton";

const KIND_KEY = "NELVA_WALLET_KIND";
const CANTON_PARTY_KEY = "NELVA_CANTON_PARTY";

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getWalletKind(): WalletKind {
  return (ls()?.getItem(KIND_KEY) as WalletKind) ?? "embedded";
}

/** Record the active Canton (gateway) wallet — kind + party. */
export function setCantonActive(party: string): void {
  const s = ls();
  s?.setItem(KIND_KEY, "canton");
  s?.setItem(CANTON_PARTY_KEY, party);
}

/** Record the active embedded wallet. */
export function setEmbeddedActive(): void {
  ls()?.setItem(KIND_KEY, "embedded");
}

export function clearActiveWallet(): void {
  const s = ls();
  s?.removeItem(KIND_KEY);
  s?.removeItem(CANTON_PARTY_KEY);
}

/** The party id of whichever wallet is connected, or null. */
export function activeParty(): string | null {
  if (getWalletKind() === "canton") return ls()?.getItem(CANTON_PARTY_KEY) ?? null;
  return wallet.party();
}
