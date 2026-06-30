// Drives the BE wallet relay: connect (onboard → sign multiHash → allocate) and
// submitAsWallet (prepare → sign prepared-hash → execute). The signing happens in
// keyholder.ts (browser-local); the BE never sees the private key.
import { API_BASE_URL } from "@/config/env";
import { publicKeyDerB64, signHashB64, wallet } from "./keyholder";

async function call<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Wallet request failed (${res.status})`;
    throw new Error(message);
  }
  return payload as T;
}

type OnboardResponse = {
  partyId: string;
  multiHash: string;
  fingerprint: string;
  topologyTransactions: unknown[];
};
type PrepareResponse = {
  preparedTransaction: string;
  preparedTransactionHash: string;
  hashingSchemeVersion: string;
};

/** Onboard the browser key as a real external Canton party. Returns the party id. Idempotent. */
export async function connectWallet(partyHint: string): Promise<string> {
  // already onboarded -> re-attach to the SAME party (don't re-onboard the key)
  const existing = wallet.party();
  if (existing) {
    const fp = wallet.fingerprint();
    if (fp) wallet.setSession(existing, fp);
    return existing;
  }

  const publicKey = await publicKeyDerB64();
  const onb = await call<OnboardResponse>("/wallet/onboard", { partyHint, publicKey });
  const multiHashSignature = await signHashB64(onb.multiHash);
  await call("/wallet/allocate", {
    topologyTransactions: onb.topologyTransactions,
    fingerprint: onb.fingerprint,
    multiHashSignature,
  });
  wallet.setSession(onb.partyId, onb.fingerprint);
  return onb.partyId;
}

/** Submit Daml commands signed by the connected wallet (key stays local). */
export async function submitAsWallet(commands: unknown[]): Promise<void> {
  const party = wallet.party();
  const fingerprint = wallet.fingerprint();
  if (!party || !fingerprint) throw new Error("Wallet not connected.");

  const prep = await call<PrepareResponse>("/wallet/prepare", { party, commands });
  const signature = await signHashB64(prep.preparedTransactionHash);
  await call("/wallet/execute", {
    party,
    preparedTransaction: prep.preparedTransaction,
    hashingSchemeVersion: prep.hashingSchemeVersion,
    fingerprint,
    signature,
  });
}

export { wallet };
