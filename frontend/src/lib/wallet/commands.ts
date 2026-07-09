// Builds + submits real Nelva actions signed by the connected wallet.
// Each step is a wallet-signed transaction over the BE relay; the embedded
// wallet signs silently, so a single user click runs the whole chain.
import { API_BASE_URL } from "@/config/env";
import { submitViaCantonWallet } from "./canton";
import { submitAsWallet } from "./client";
import { activeParty, getWalletKind } from "./walletMode";

type Config = {
  packageId: string;
  parties: { operator: string; auditor: string; custodian: string };
};
type Holding = {
  cid: string;
  amount: number;
  instrument: string;
  locked: boolean;
};

const DEADLINE = "2030-01-01T00:00:00Z";
let cachedConfig: Config | null = null;

async function getConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch(`${API_BASE_URL}/config`);
  cachedConfig = (await res.json()) as Config;
  return cachedConfig;
}

// route a wallet-signed submission to the active transport: the hosted CIP-0103
// gateway (canton) or the embedded-key BE relay (embedded). Command construction
// is identical — only the transport differs.
function submit(commands: unknown[], disclosed: unknown[] = []): Promise<void> {
  return getWalletKind() === "canton"
    ? submitViaCantonWallet(commands, disclosed)
    : submitAsWallet(commands, disclosed);
}

async function walletHoldings(): Promise<Holding[]> {
  const party = activeParty();
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
export async function placeBidAsWallet(
  amount: number,
  rate: number,
): Promise<void> {
  const party = activeParty();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId, parties } = await getConfig();
  const holdingTid = `${packageId}:Nelva.Asset:Holding`;
  const bidTid = `${packageId}:Nelva.Lending:SealedBid`;

  const holdings = await walletHoldings();
  const source = holdings.find((h) => !h.locked && h.amount >= amount);
  if (!source) throw new Error("Not enough available balance for this bid.");

  // 1. split off exactly `amount` if the holding is bigger
  let bidCid = source.cid;
  if (source.amount > amount) {
    const before = new Set(holdings.map((h) => h.cid));
    await submit([
      {
        ExerciseCommand: {
          templateId: holdingTid,
          contractId: source.cid,
          choice: "Split",
          choiceArgument: { splitAmount: String(amount) },
        },
      },
    ]);
    const piece = await holdingsUntil((hs) =>
      hs.find((h) => !before.has(h.cid) && !h.locked && near(h.amount, amount)),
    );
    bidCid = piece.cid;
  }

  // 2. lock the bid amount to the operator (pre-authorization for matching)
  const beforeLock = new Set((await walletHoldings()).map((h) => h.cid));
  await submit([
    {
      ExerciseCommand: {
        templateId: holdingTid,
        contractId: bidCid,
        choice: "Lock",
        choiceArgument: { newLocker: parties.operator },
      },
    },
  ]);
  const locked = await holdingsUntil((hs) =>
    hs.find(
      (h) => h.locked && !beforeLock.has(h.cid) && near(h.amount, amount),
    ),
  );

  // 3. create the sealed bid
  await submit([
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

/** Submit a real borrow intent: split + lock collateral, then create a BorrowIntent — all wallet-signed. */
export async function borrowAsWallet(
  amount: number,
  maxRate: number,
  collateralAmount: number,
): Promise<void> {
  const party = activeParty();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId, parties } = await getConfig();
  const holdingTid = `${packageId}:Nelva.Asset:Holding`;
  const borrowTid = `${packageId}:Nelva.Lending:BorrowIntent`;

  // The BorrowIntent's tier MUST equal the borrower's real CreditScore tier: the ledger's
  // `ensure` sizes collateral by multiplier(tier), and RunMatch drops a borrow whose tier != its
  // score. Hardcoding "Bronze" broke as soon as a borrower ranked up (e.g. Silver needs 1.8x, but
  // a Bronze intent demands 2x -> "ledger rejected"). Read the real tier from the BE.
  const quote = await fetch(
    `${API_BASE_URL}/collateral-quote?party=${encodeURIComponent(party)}&amount=${amount}&instrument=USD`,
    { headers: { Authorization: `Bearer ${party}` } },
  ).then((r) => r.json());
  const tier = quote?.tier ?? "Bronze";

  const holdings = await walletHoldings();
  const source = holdings.find(
    (h) => !h.locked && h.amount >= collateralAmount,
  );
  if (!source) throw new Error("Not enough collateral available.");

  let collateralCid = source.cid;
  if (source.amount > collateralAmount) {
    const before = new Set(holdings.map((h) => h.cid));
    await submit([
      {
        ExerciseCommand: {
          templateId: holdingTid,
          contractId: source.cid,
          choice: "Split",
          choiceArgument: { splitAmount: String(collateralAmount) },
        },
      },
    ]);
    const piece = await holdingsUntil((hs) =>
      hs.find(
        (h) =>
          !before.has(h.cid) && !h.locked && near(h.amount, collateralAmount),
      ),
    );
    collateralCid = piece.cid;
  }

  const beforeLock = new Set((await walletHoldings()).map((h) => h.cid));
  await submit([
    {
      ExerciseCommand: {
        templateId: holdingTid,
        contractId: collateralCid,
        choice: "Lock",
        choiceArgument: { newLocker: parties.operator },
      },
    },
  ]);
  const locked = await holdingsUntil((hs) =>
    hs.find(
      (h) =>
        h.locked && !beforeLock.has(h.cid) && near(h.amount, collateralAmount),
    ),
  );

  await submit([
    {
      CreateCommand: {
        templateId: borrowTid,
        createArguments: {
          borrower: party,
          matchingOperator: parties.operator,
          auditor: parties.auditor,
          borrowId: `borrow-${Date.now()}`,
          collateralCid: locked.cid,
          collateralAmount: String(collateralAmount),
          amount: String(amount),
          maxRate: String(maxRate),
          tier,
          instrument: "USD",
          deadline: DEADLINE,
        },
      },
    },
  ]);
}

/** Accept a match proposal as the wallet borrower — draws lender funds + collateral
 *  and creates the Loan, all in one wallet-signed transaction. The BE supplies the
 *  disclosed contracts (the matched bids + their locked holdings) the borrower can't see. */
export async function acceptAsWallet(proposalCid: string): Promise<void> {
  const party = activeParty();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId } = await getConfig();
  // accept-info is auth-gated (it returns rivals' matched SealedBid blobs) — without the
  // Bearer it 401s, info.disclosed falls back to [], and the Accept then prepares with no
  // disclosed bids so the ledger can't resolve them (409 "contract not found").
  const info = await fetch(
    `${API_BASE_URL}/wallet/accept-info?proposalId=${encodeURIComponent(proposalCid)}`,
    { headers: { Authorization: `Bearer ${party}` } },
  ).then((r) => r.json());
  if (info?.error) throw new Error(String(info.error));
  await submit(
    [
      {
        ExerciseCommand: {
          templateId: `${packageId}:Nelva.Settlement:MatchProposal`,
          contractId: proposalCid,
          choice: "Accept",
          choiceArgument: {},
        },
      },
    ],
    info.disclosed ?? [],
  );
}

/** Repay a loan as the wallet borrower — pays each lender principal + interest and
 *  reclaims collateral, all wallet-signed. The borrower pays from their OWN unlocked
 *  holding (> owed), not minted funds; the BE supplies the operator-signed
 *  CreditScore (BumpUp target) as a disclosed contract. */
export async function repayAsWallet(loanId: string): Promise<void> {
  const party = activeParty();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId } = await getConfig();
  const info = await fetch(
    `${API_BASE_URL}/wallet/repay-info?party=${encodeURIComponent(party)}&loanId=${encodeURIComponent(loanId)}`,
  ).then((r) => r.json());
  if (info?.error) throw new Error(String(info.error));
  const owed = Number(info.owed);

  // payLenders splits `owed` out of one holding and returns the change, so the
  // source must be a single unlocked holding strictly greater than owed.
  const source = (await walletHoldings()).find(
    (h) => !h.locked && h.amount > owed,
  );
  if (!source) {
    throw new Error(
      `Not enough liquid balance to repay — need a single holding above ${owed.toFixed(2)} nUSD.`,
    );
  }

  await submit(
    [
      {
        ExerciseCommand: {
          templateId: `${packageId}:Nelva.Settlement:Loan`,
          contractId: loanId,
          choice: "Repay",
          choiceArgument: {
            repaymentCid: source.cid,
            creditScoreCid: info.creditScoreCid,
            // Loan.Repay retires each lender's LoanPosition; the BE discloses them + returns the cids.
            positionCids: info.positionCids ?? [],
          },
        },
      },
    ],
    info.disclosed ?? [],
  );
}

/** Walk away from a match proposal as the wallet borrower — 5% of collateral is
 *  slashed to the operator, 95% returned unlocked. The collateral is borrower-owned
 *  and the operator authority comes from the proposal's signature, so no disclosed
 *  contracts are needed. */
export async function rejectAsWallet(proposalCid: string): Promise<void> {
  const { packageId } = await getConfig();
  await submit([
    {
      ExerciseCommand: {
        templateId: `${packageId}:Nelva.Settlement:MatchProposal`,
        contractId: proposalCid,
        choice: "Reject",
        choiceArgument: {},
      },
    },
  ]);
}

/** Cancel an unmatched borrow intent as the wallet borrower and reclaim the collateral.
 *  Asset.Unlock is controller=owner=borrower, so the borrower's signature suffices — no
 *  disclosed contracts, no operator authority. */
export async function cancelBorrowAsWallet(borrowCid: string): Promise<void> {
  const { packageId } = await getConfig();
  await submit([
    {
      ExerciseCommand: {
        templateId: `${packageId}:Nelva.Lending:BorrowIntent`,
        contractId: borrowCid,
        choice: "Cancel",
        choiceArgument: {},
      },
    },
  ]);
}

/** Withdraw a sealed bid as the wallet lender after its deadline (anti-griefing) and
 *  reclaim the locked funds. Controller=lender; the SC rejects it before the deadline. */
export async function withdrawBidAsWallet(bidCid: string): Promise<void> {
  const { packageId } = await getConfig();
  await submit([
    {
      ExerciseCommand: {
        templateId: `${packageId}:Nelva.Lending:SealedBid`,
        contractId: bidCid,
        choice: "WithdrawBid",
        choiceArgument: {},
      },
    },
  ]);
}

/** Reclaim collateral ABOVE the required amount on an active loan, wallet-signed. The
 *  borrower can't see the oracle price nor the operator-owned escrow, so the BE discloses
 *  both and returns the price cid to pass. */
export async function claimExcessAsWallet(loanCid: string): Promise<void> {
  const party = activeParty();
  if (!party) throw new Error("Wallet not connected.");
  const { packageId } = await getConfig();
  const info = await fetch(
    `${API_BASE_URL}/wallet/claim-excess-info?party=${encodeURIComponent(party)}&loanId=${encodeURIComponent(loanCid)}`,
    { headers: { Authorization: `Bearer ${party}` } },
  ).then((r) => r.json());
  if (info?.error) throw new Error(String(info.error));
  await submit(
    [
      {
        ExerciseCommand: {
          templateId: `${packageId}:Nelva.Settlement:Loan`,
          contractId: loanCid,
          choice: "ClaimExcess",
          choiceArgument: { priceCid: info.priceCid },
        },
      },
    ],
    info.disclosed ?? [],
  );
}
