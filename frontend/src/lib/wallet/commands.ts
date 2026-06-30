// Builds + submits real Nelva actions signed by the connected wallet.
// Each step is a wallet-signed transaction over the BE relay; the embedded
// wallet signs silently, so a single user click runs the whole chain.
import { API_BASE_URL } from "@/config/env";
import { submitAsWallet, wallet } from "./client";

type Config = {
  packageId: string;
  parties: { operator: string; auditor: string; custodian: string };
};
type Holding = { cid: string; amount: number; instrument: string; locked: boolean };

const DEADLINE = "2030-01-01T00:00:00Z";
let cachedConfig: Config | null = null;

async function getConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch(`${API_BASE_URL}/config`);
  cachedConfig = (await res.json()) as Config;
  return cachedConfig;
}

async function walletHoldings(): Promise<Holding[]> {
  const party = wallet.party();
  if (!party) return [];
  const res = await fetch(`${API_BASE_URL}/wallet/holdings`, {
    headers: { Authorization: `Bearer ${party}` },
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// interactive execute is async — poll the ACS until the expected new holding appears.
async function holdingsUntil(
  pick: (hs: Holding[]) => Holding | undefined,
  tries = 20,
): Promise<Holding> {
  for (let i = 0; i < tries; i++) {
    const found = pick(await walletHoldings());
    if (found) return found;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error("The ledger did not settle in time — please retry.");
}

/** Place a real sealed bid: split (if needed) -> lock -> create SealedBid, all wallet-signed. */
export async function placeBidAsWallet(amount: number, rate: number): Promise<void> {
  const party = wallet.party();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId, parties } = await getConfig();
  const holdingTid = `${packageId}:Nelva.Asset:Holding`;
  const bidTid = `${packageId}:Nelva.Lending:SealedBid`;

  let holdings = await walletHoldings();
  const source = holdings.find((h) => !h.locked && h.amount >= amount);
  if (!source) throw new Error("Not enough available balance for this bid.");

  // 1. split off exactly `amount` if the holding is bigger
  let bidCid = source.cid;
  if (source.amount > amount) {
    const before = new Set(holdings.map((h) => h.cid));
    await submitAsWallet([
      { ExerciseCommand: { templateId: holdingTid, contractId: source.cid, choice: "Split", choiceArgument: { splitAmount: String(amount) } } },
    ]);
    const piece = await holdingsUntil((hs) => hs.find((h) => !before.has(h.cid) && !h.locked && near(h.amount, amount)));
    bidCid = piece.cid;
  }

  // 2. lock the bid amount to the operator (pre-authorization for matching)
  const beforeLock = new Set((await walletHoldings()).map((h) => h.cid));
  await submitAsWallet([
    { ExerciseCommand: { templateId: holdingTid, contractId: bidCid, choice: "Lock", choiceArgument: { newLocker: parties.operator } } },
  ]);
  const locked = await holdingsUntil((hs) => hs.find((h) => h.locked && !beforeLock.has(h.cid) && near(h.amount, amount)));

  // 3. create the sealed bid
  await submitAsWallet([
    {
      CreateCommand: {
        templateId: bidTid,
        createArguments: {
          lender: party,
          matchingOperator: parties.operator,
          auditor: parties.auditor,
          bidId: `bid-${Date.now()}`,
          holdingCid: locked.cid,
          amount: String(amount),
          bidRate: String(rate),
          instrument: "USD",
          deadline: DEADLINE,
        },
      },
    },
  ]);
}
