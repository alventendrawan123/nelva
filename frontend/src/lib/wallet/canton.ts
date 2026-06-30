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
// Gated by CANTON_GATEWAY_URL: unset (sandbox demo) -> module stays dormant and
// the app uses the embedded wallet only.
import {
  init,
  connect,
  disconnect,
  listAccounts,
  prepareExecuteAndWait,
  status,
  RemoteAdapter,
  ExtensionAdapter,
} from "@canton-network/dapp-sdk";
import type { ProviderAdapter, Wallet } from "@canton-network/dapp-sdk";
import { CANTON_GATEWAY_URL } from "@/config/env";

/** Is a real Canton wallet path available in this deployment? */
export const cantonWalletEnabled = (): boolean => Boolean(CANTON_GATEWAY_URL);

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  const adapters: ProviderAdapter[] = [];
  if (CANTON_GATEWAY_URL) {
    adapters.push(
      new RemoteAdapter({
        providerId: "nelva-gateway",
        rpcUrl: CANTON_GATEWAY_URL,
        name: "Canton Wallet",
        description: "Sign in with your Canton wallet",
      }),
    );
  }
  // a CIP-0103 browser extension (e.g. Reference Wallet) shows up too if installed
  adapters.push(new ExtensionAdapter({ name: "Canton Wallet Extension" }));
  await init({ defaultAdapters: adapters, enableSuggestedWallets: true });
  initialized = true;
}

function primaryParty(wallets: Wallet[]): string {
  const primary = wallets.find((w) => w.primary) ?? wallets[0];
  if (!primary?.partyId) throw new Error("Wallet returned no Canton account.");
  return primary.partyId;
}

/** Open the wallet picker, connect, and return the primary party id. */
export async function connectCantonWallet(): Promise<string> {
  await ensureInit();
  await connect(); // opens the Discovery picker (RemoteAdapter / extension / WC)
  return primaryParty(await listAccounts());
}

/** Re-attach to a persisted wallet session on mount (no picker). null if none. */
export async function restoreCantonWallet(): Promise<string | null> {
  await ensureInit();
  const current = await status();
  if (!current.connection?.isConnected) return null;
  try {
    return primaryParty(await listAccounts());
  } catch {
    return null;
  }
}

export async function disconnectCantonWallet(): Promise<void> {
  try {
    await disconnect();
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
): Promise<void> {
  await prepareExecuteAndWait({
    commands: commands as never,
    disclosedContracts: disclosedContracts as never,
  });
}
