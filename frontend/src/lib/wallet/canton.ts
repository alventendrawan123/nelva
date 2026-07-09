"use client";
// Real Canton wallet via the CIP-0103 dApp SDK (@canton-network/dapp-sdk).
//
// Unlike the embedded wallet (browser-held key + BE relay), here the WALLET owns
// the keys and the participant-node context. We only hand it Daml commands;
// prepareExecuteAndWait makes the wallet prepare, sign and execute them on its
// own node. Two ways to reach a wallet:
//   - RemoteAdapter  -> a hosted Wallet Gateway we run next to the Nelva validator
//                       (rpcUrl). This is what lets a judge connect with NO local
//                       node — the gateway is the node.
//   - ExtensionAdapter -> a CIP-0103 browser-extension wallet the user installed.
//
// The SDK pulls in Lit web components that touch `HTMLElement` at module-eval
// time, which crashes server-side rendering. So it is loaded lazily (dynamic
// import), in the browser only, the first time a wallet action runs. Importing
// THIS module stays SSR-safe — only types are imported statically.
import type { ProviderAdapter, Wallet } from "@canton-network/dapp-sdk";
import { CANTON_GATEWAY_URL } from "@/config/env";

/** Is a real Canton wallet path available in this deployment? */
export const cantonWalletEnabled = (): boolean => Boolean(CANTON_GATEWAY_URL);

type Sdk = typeof import("@canton-network/dapp-sdk");
let sdkPromise: Promise<Sdk> | null = null;
const loadSdk = (): Promise<Sdk> => {
  if (!sdkPromise) {
    sdkPromise = import("@canton-network/dapp-sdk");
  }
  return sdkPromise;
};

let initialized = false;

async function ensureInit(): Promise<Sdk> {
  const sdk = await loadSdk();
  if (initialized) return sdk;
  const adapters: ProviderAdapter[] = [];
  if (CANTON_GATEWAY_URL) {
    adapters.push(
      new sdk.RemoteAdapter({
        providerId: "nelva-gateway",
        rpcUrl: CANTON_GATEWAY_URL,
        name: "Canton Wallet",
        description: "Sign in with your Canton wallet",
      }),
    );
  }
  // a CIP-0103 browser extension (e.g. Reference Wallet) shows up too if installed
  adapters.push(new sdk.ExtensionAdapter({ name: "Canton Wallet Extension" }));
  await sdk.init({ defaultAdapters: adapters, enableSuggestedWallets: true });
  initialized = true;
  return sdk;
}

// some CIP-0103 wallets return a single Wallet instead of an array (the dapp-sdk
// `ping` example ships a normalizeWalletList for this) — accept both shapes.
function primaryParty(result: Wallet[] | Wallet): string {
  const wallets = Array.isArray(result) ? result : [result];
  const primary = wallets.find((w) => w.primary) ?? wallets[0];
  if (!primary?.partyId) throw new Error("Wallet returned no Canton account.");
  return primary.partyId;
}

/** Open the wallet picker, connect, and return the primary party id. */
export async function connectCantonWallet(): Promise<string> {
  const sdk = await ensureInit();
  await sdk.connect(); // opens the Discovery picker (RemoteAdapter / extension / WC)
  return primaryParty(await sdk.listAccounts());
}

/** Re-attach to a persisted wallet session on mount (no picker). null if none. */
export async function restoreCantonWallet(): Promise<string | null> {
  const sdk = await ensureInit();
  const current = await sdk.status();
  if (!current.connection?.isConnected) return null;
  try {
    return primaryParty(await sdk.listAccounts());
  } catch {
    return null;
  }
}

export async function disconnectCantonWallet(): Promise<void> {
  const sdk = await loadSdk();
  try {
    await sdk.disconnect();
  } catch {
    /* already disconnected */
  }
}

/**
 * Submit Daml commands through the connected Canton wallet. `commands` are the
 * same Ledger-API CreateCommand/ExerciseCommand objects the embedded path builds,
 * so command construction in commands.ts is reused verbatim — only the submit
 * transport differs (wallet prepare+sign+execute vs the BE relay).
 */
export async function submitViaCantonWallet(
  commands: unknown[],
  disclosedContracts: unknown[] = [],
): Promise<string | undefined> {
  const sdk = await loadSdk();
  const result = (await sdk.prepareExecuteAndWait({
    commandId: crypto.randomUUID(), // idempotency / tracking per submission
    commands: commands as never,
    disclosedContracts: disclosedContracts as never,
  })) as { updateId?: string; transactionId?: string } | undefined;
  // surface the committed transaction's id (tx hash) when the wallet reports one
  return result?.updateId ?? result?.transactionId;
}
