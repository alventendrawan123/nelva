# Nelva

**Private sealed-bid P2P lending on Canton — rates stay sealed, and the match is provably honest.**

[Live app](https://nelva-ashy.vercel.app) · Demo video *(coming with submission)* · [GitHub](https://github.com/alventendrawan123/nelva)

Nelva is a sealed-bid peer-to-peer lending market deployed on **Canton DevNet**. Lenders bid capital at private rates; borrowers post collateral and borrow at a blended rate; a deterministic matching engine pairs them **on-ledger**. The rates never leak to rivals — Canton's sub-transaction privacy scopes every contract to its stakeholders — and yet nobody has to trust the operator: an **independent auditor re-runs the exact same match on-ledger** and stamps a GREEN/RED verdict, while the settlement step itself **re-validates the match and refuses to settle a dishonest one**.

> **Sealed rates. Deterministic matching. Honesty you can re-run.**

1. **Lender** posts a sealed bid (amount + rate). Rival lenders — and every borrower — can never read it.
2. **Borrower** locks tier-priced collateral and accepts a match; funds and collateral settle **atomically in one transaction**.
3. **Auditor** — its own process, its own party, its own terminal — re-executes the match over every committed bid and signs an on-ledger **GREEN/RED AuditBadge**.

---

## Who This Is For

Meet a desk lender we'll call Anda. She lends stablecoins on a public money market. Every rate she quotes sits on the order book for the whole market to read — the moment she prices aggressively, competitors undercut her by a basis point and borrowers game the queue. Last quarter she moved to a private OTC matching service to stop the bleeding. Now she has the opposite problem: the operator's engine is a black box. When her 3% bid sat unfilled while the book cleared at 5%, she had no way to prove the operator didn't skip her to route flow to a friendlier counterparty.

Anda's problem isn't a missing lending market. It's that **every existing market makes her choose between privacy and proof**. Public order books leak her hand; private matchers ask for blind faith.

Nelva refuses the trade-off: her rate is sealed by the ledger itself (not by the operator's goodwill), and the match that fills — or skips — her bid can be re-executed and verified by a party the operator does not control.

## The Problem

Lending markets leak or lie:

- **Public order books leak.** A rate on a transparent chain is a signal to every rival. Aggressive quotes get front-run; borrowers' positions and collateral levels become public intelligence.
- **Private matchers must be trusted.** A confidential venue can fill priciest-first, skip a cheap lender, and skim the spread — and no participant can prove it happened, because nobody can see the full book.
- **"Trust me" isn't an audit.** Even an honest operator can't *demonstrate* honesty when the inputs are secret. Screenshots of a private database prove nothing.
- **Encryption bolt-ons don't fix it.** Encrypting a public chain's data still publishes the graph (who, when, how much), and TEE-style black boxes move the trust — they don't remove it, because nobody re-executes what ran inside.

How might we run a lending market where **rates stay private between each party and the engine**, yet **anyone entitled to check can prove the match was computed honestly** — and a dishonest match can't even settle?

## The Solution

Nelva composes four primitives, all enforced at the Daml contract layer:

**1. Sealed bids — privacy by ledger scoping, not encryption.** A `SealedBid` is signed by the lender and observed *only* by the matching operator and the auditor. Rival lenders are not observers, so by Canton's per-party projection they physically never receive the contract. There is no ciphertext to crack — the data simply never travels to anyone else's node.

**2. Deterministic matching, on-ledger.** The operator's `RunMatch` choice executes a pure, deterministic cheapest-first algorithm *inside the Daml transaction*: cheapest capital fills each borrow, the borrower pays one blended rate, each lender keeps its own rate (discriminatory pricing — honest bidding is the dominant strategy). Same inputs → same output, forever. That determinism is what makes honesty *checkable*.

**3. Prevent-by-construction settlement.** When the borrower exercises `Accept`, the choice **re-fetches the committed bids and re-runs the deterministic match**, then asserts the published ticks and blended rate equal the honest recompute. A fabricated proposal doesn't get "caught later" — it **fails to settle at all** (`DAML_FAILURE`). Funds and collateral then move atomically in that same transaction; the operator never custodies anything.

**4. Independent auditor — GREEN / RED, from a terminal the operator doesn't run.** `auditor/audit.mjs` is a standalone CLI that connects straight to the Canton ledger as the Auditor party (no Nelva backend involved), creates a `VerifyRequest`, and exercises `Verify` — which re-executes the same match over *every* committed bid, winners and losers, and creates an auditor-signed `AuditBadge` on-ledger: **GREEN** (published == recompute) or **RED** (operator fabricated). The demo includes a "Cheat Match" button that makes the operator publish a priciest-first match — the auditor flips RED and `Accept` refuses it.

Plus a **credit-tier ladder** that turns repayment history into cheaper collateral (below), a **built-in explorer** for every on-ledger transaction, and a real **non-custodial wallet** flow (your key never leaves the browser).

## Why Canton Is Central, Not a Swap-Out

| Canton mechanic | Where Nelva uses it | Why it matters |
|---|---|---|
| Sub-transaction privacy (signatory/observer projection) | `SealedBid`, `BorrowIntent`, `Loan`, `LoanPosition`, `AuditBadge` | Rival lenders never receive each other's rates; co-funders of one loan never learn each other's ticks. Not hidden by the UI — never delivered to their nodes. |
| Atomic multi-party settlement | `Accept` | Lender funds + borrower collateral + loan creation commit in **one** transaction. No escrow service, no partial states, no operator custody. |
| Deterministic Daml execution | `RunMatch`, `Verify`, `Accept` re-validation | The same pure function runs at match time, at audit time, and at settlement time. Byte-for-byte reproducibility is the entire honesty proof. |
| Signatory-based authorization | every choice | The operator literally cannot forge a lender's bid or move funds outside a choice the stakeholders' signatures authorize. |
| External-party signing (CIP-0103 pattern) | wallet connect / every user action | Users are real Canton external parties signing with their own ed25519 key in the browser — Nelva never holds keys or funds. |
| Smart-contract upgrades (SCU) | nelva-sc 0.2.0 → 0.3.0 | A logic fix (liquidation health floor) shipped as a compatible upgrade; existing loans and credit scores kept working under the new rules without migration. |

Remove Canton and every pillar collapses: a public chain leaks the book (no sealed bids), a private database can't be re-executed by an outside party (no auditor), and nothing else gives atomic multi-party settlement without an escrow contract holding user funds.

On explorers: Canton delivers transactions **only to their stakeholders**. Public explorers (Cantonscan, CC Explorer) index Canton-Coin/DSO activity and can never see a Nelva transaction — by design. That's why Nelva ships its own stakeholder-run explorer (below): the Etherscan experience, served by a node actually entitled to the data.

## Features

- **Sealed-bid lending** — post amount + rate; the rate is visible to the matching engine and auditor only.
- **Private borrowing** — post amount + max rate + collateral; your max rate never reaches rival borrowers.
- **One-click deterministic match** (operator) — cheapest-first, blended rate, discriminatory pricing.
- **Cheat Match demo button** (operator) — publishes a deliberately dishonest match so judges can watch the auditor flip RED and `Accept` reject it.
- **Terminal auditor** — `node auditor/audit.mjs` re-verifies every pending proposal on-ledger and prints GREEN/RED, with an auditor-signed `AuditBadge` as the receipt.
- **Credit tiers (Bronze → Platinum)** — every repaid loan ranks the borrower up; higher tiers lock less collateral. Defaults rank down.
- **Claim Excess** — withdraw collateral above your tier's requirement mid-loan, health-checked against a fresh oracle price.
- **Repay / Cancel / Withdraw** — full lifecycle, all wallet-signed: repay principal + interest (collateral returns, tier bumps), cancel an unmatched borrow, withdraw an expired bid.
- **Liquidation** — an unhealthy or matured loan pays lenders pro-rata (5% operator fee), and the borrower's tier drops.
- **Tx hash on every action** — each signed action resolves to its committed Canton update id, shown in the success toast and logged in a navbar history panel.
- **Nelva Explorer** — `/tx/<updateId>` renders any transaction live from the ledger (events, contracts created/archived, arguments, signatories); `/address?party=` lists a party's full transaction history. Every row's ↗ opens its creating transaction.
- **Real wallet, non-custodial** — the browser generates an ed25519 key, onboards as a Canton external party, and signs every transaction locally (interactive-submission prepare → sign → execute). A hosted CIP-0103 wallet gateway is supported alongside.
- **k-anonymous market stats** — the Explore page aggregates volumes but suppresses any figure backed by fewer than two distinct parties, so a "total" can never expose one participant's position.
- **Swap + oracle price feeds** — operator-signed `PriceUpdate`s drive collateral health checks and a simple instrument swap.
- **Faucet + demo personas** — one click to fund a test wallet on DevNet.

## Credit Tier Ladder

Repayment history is on-ledger reputation. Every borrower starts at Bronze; each successful `Repay` exercises `BumpUp`, each liquidation exercises `BumpDown`.

| Tier | Collateral multiplier | Collateral to borrow 100 nUSD | How to reach it |
|---|---|---|---|
| 🥉 Bronze | 2.0× | 200 | starting tier |
| 🥈 Silver | 1.8× | 180 | 1 repaid loan |
| 🥇 Gold | 1.5× | 150 | 2 repaid loans |
| 💎 Platinum | 1.2× | 120 | 3 repaid loans (top) |

```
🥉 Bronze ──repay──▶ 🥈 Silver ──repay──▶ 🥇 Gold ──repay──▶ 💎 Platinum
   2.0×                1.8×                1.5×                1.2×
              less collateral locked as trust grows ───────────▶
```

The liquidation health floor is **1.1** — deliberately below Platinum's 1.2× — so no tier is under water at its own minimum, and `ClaimExcess` refuses any withdrawal that would drop a loan below it at the current oracle price.

## Who Sees What (the Daml privacy model)

Privacy in Nelva is structural — it lives in each template's `signatory`/`observer` declarations, not in the UI:

| Template | Signatory | Observers | Deliberately excluded |
|---|---|---|---|
| `Asset:Holding` | custodian | owner, locker | everyone else — balances are private to their owner |
| `Lending:SealedBid` | lender | operator, auditor | **rival lenders and all borrowers** — nobody else ever receives the rate |
| `Lending:BorrowIntent` | borrower | operator, auditor | rival borrowers, all lenders |
| `Credit:CreditScore` | operator | borrower | other borrowers, lenders |
| `Settlement:MatchProposal` | operator | borrower, auditor | **matched lenders** — a pending proposal would leak the borrower's demand before acceptance |
| `Settlement:Loan` | borrower, operator | auditor | **the lenders** — a co-funder must not read rival ticks/rates via the loan record |
| `Settlement:LoanPosition` | operator | its one lender | other co-funders — each lender sees only its own slice |
| `Settlement:AuditBadge` | auditor | operator, borrower | lenders — the badge lists the full lender set, which would disclose co-funders to each other |
| `Settlement:PriceUpdate` | oracle | operator | — (disclosed to a borrower per-transaction when a health check needs it) |

The frontend's **Lens** view walks these projections party-by-party (lender / borrower / operator / auditor / outsider) — each pane is a real per-party read from the ledger, not a filtered mock.

## Architecture

```
USER ROLES
├── Lender      (sealed bids, withdraws, receives repayment pro-rata)
├── Borrower    (borrow intents, accept/reject, repay, claim excess)
├── Operator    (runs the deterministic match; can try to cheat — and gets caught)
└── Auditor     (independent party; re-runs the match from its own terminal)

FRONTEND · Next.js 16 — nelva-ashy.vercel.app
└─ / (landing) · /app (market) · /explore · /profile
   /tx/<updateId> · /address?party=   ← built-in ledger explorer
   browser-held ed25519 key; every action signed locally

BACKEND · Node/Express on Railway — stateless gateway, no database
└─ REST for the FE · builds commands + disclosed contracts
   relays interactive-submission (prepare → user signs → execute)
   the ledger is the only source of truth

AUDITOR CLI · auditor/audit.mjs — runs anywhere, not part of the app
└─ connects straight to the ledger as the Auditor party
   VerifyRequest → Verify → GREEN/RED AuditBadge, on-ledger

SMART CONTRACTS · Daml (nelva-sc 0.3.0) on Canton DevNet
└─ Asset · Lending · Credit · Match (pure engine) · Settlement
   deployed to a 5North shared validator, global synchronizer

CANTON DEVNET
└─ ledger-api.validator.devnet.sandbox.fivenorth.io
```

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Daml (SDK 3.4.11) · built with DPM · deployed to a 5North DevNet validator (Seaport) |
| Matching engine | pure Daml module (`Nelva.Match`) shared verbatim by `RunMatch`, `Verify`, and `Accept` re-validation |
| Frontend | Next.js 16 (Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · framer-motion |
| State | React Query (server state) · zod (schema-validated API layer) |
| Wallet | browser ed25519 keypair (`@noble/ed25519`) as a Canton external party · `@canton-network/dapp-sdk` (CIP-0103) for hosted-gateway wallets |
| Backend | Node 20 · Express · TypeScript (`tsx`) on Railway · stateless, no DB |
| Ledger access | Canton JSON Ledger API v2 (active-contracts, interactive-submission, updates, completions) · OAuth2 M2M client-credentials |
| Auditor | plain Node CLI — nothing beyond `fetch` |
| Lint / format | Biome (frontend) |

## Setup

Three independent pieces: `sc/` (Daml), `be/` (gateway), `frontend/` (app). The auditor CLI needs only Node.

### Prerequisites

- Node ≥ 20 · pnpm (frontend) · npm (backend)
- [DPM](https://docs.canton.network) + JDK 17 for building the DAR (Windows: use WSL)
- A ledger to run against — either a local sandbox (`dpm sandbox`, JSON API on `:7575`) or a Canton DevNet validator + OAuth2 M2M credentials

### 1 · Smart contracts

```bash
cd sc
dpm build          # → .daml/dist/nelva-sc-0.3.0.dar
dpm test           # Daml Script suites: FlowTest, MatchTest, SettleTest
```

Upload the DAR to your participant (Seaport UI, or `POST /v2/packages`), and note the **main package id** (`dpm damlc inspect-dar --json`).

### 2 · Backend

```bash
cd be
npm install
```

Environment (never commit secrets):

```bash
LEDGER_MODE=canton
JSON_LEDGER_API=https://<your-validator-json-api>
NELVA_PACKAGE_ID=<64-hex main package id of nelva-sc>
NELVA_PARTY_PREFIX=nelva-          # scopes party hints on a shared validator
AUTH_TOKEN_URL=<oauth2 token endpoint>
AUTH_CLIENT_ID=<m2m client id>
AUTH_CLIENT_SECRET=<m2m client secret>
AUTH_AUDIENCE=<audience>
AUTH_SCOPE=daml_ledger_api
AUTO_MATCH=1                       # optional: auto-run the match on new intents
PORT=8090
```

```bash
npm run dev        # tsx watch src/server.ts → http://localhost:8090
```

On first run the BE allocates/ensures the app parties (`Operator`, `Auditor`, `Custodian`, `Oracle`) and seeds demo state.

### 3 · Frontend

```bash
cd frontend
pnpm install
# .env.local (all optional in local dev):
#   API_PROXY_TARGET=http://localhost:8090     # server-only; the FE calls same-origin /api
#   NEXT_PUBLIC_CANTON_GATEWAY_URL=            # set to offer a hosted CIP-0103 wallet
pnpm dev           # → http://localhost:3000
```

The browser never sees the backend URL or any ledger credential — all API traffic rides a same-origin `/api` rewrite.

### 4 · Auditor (the independent terminal)

```bash
# uses the same env vars as the BE (JSON_LEDGER_API, AUTH_*, NELVA_PACKAGE_ID, NELVA_PARTY_PREFIX)
node auditor/audit.mjs                 # verify every pending proposal
node auditor/audit.mjs <proposalCid>   # verify one
```

Prints per-proposal **GREEN ✔ / RED ✘**, each backed by an on-ledger auditor-signed `AuditBadge`.

## How It Works

### Lender flow
```
Connect wallet → Faucet → Submit sealed bid (amount, rate) → matched → repaid with interest
```
1. Connect — the browser onboards your key as a real Canton external party (or reuses it).
2. Submit a sealed bid. Under the hood: `Split` the exact amount → `Lock` it to the operator (pre-authorization) → create `SealedBid`. Three transactions, all signed by your key.
3. When matched, your funds move inside the borrower's atomic `Accept`. Your rate was never revealed to anyone but the engine and the auditor. On repayment you receive principal + your own bid's interest.

### Borrower flow
```
Faucet → Borrow (amount, max rate, collateral) → Accept proposal → Repay → tier up
```
1. The form quotes your live tier: Bronze 2.0× … Platinum 1.2×.
2. Submit — collateral splits, locks, and a `BorrowIntent` commits with your sealed max rate.
3. A `MatchProposal` appears (you and the auditor are its only observers). **Accept** re-validates the match on-ledger, then settles atomically: lender funds arrive, collateral escrows, `Loan` + per-lender `LoanPosition`s are created.
4. **Repay** pays each lender principal + its own rate, returns your collateral, and bumps your tier. Over-posted collateral? **Claim excess** mid-loan.

### Operator flow (and the cheat)
```
Run Match → proposal(s) published        Cheat Match → auditor RED → Accept refuses
```
`RunMatch` commits the full input set (every bid, including losers) so the audit runs over *committed* data, not the operator's claims. "Cheat Match" publishes a priciest-first fill — it looks plausible, pays some lenders more, and skims the borrower. Two independent defenses fire: the auditor's `Verify` flips **RED**, and the borrower's `Accept` recomputation rejects settlement outright.

### Auditor flow
```
node auditor/audit.mjs → GREEN ✔ / RED ✘ (on-ledger AuditBadge)
```
The auditor never talks to Nelva's backend. It reads the committed proposals + bids from its own ledger projection, re-runs the same pure match inside a `Verify` choice, and signs the verdict on-ledger. A RED badge is cryptographic, replayable evidence of operator fraud — not a log line in the operator's own server.

### Explorer
Every action's success toast carries its **Canton update id** (the tx hash, resolved from the ledger's completion stream). The navbar **↗ Tx** panel lists your recent transactions; every bid/borrow/loan row's ↗ opens `/tx/<updateId>` — update id, offset, effective time, synchronizer, and every event with full arguments and signatories, read live from the ledger. `/address?party=` shows any party's complete transaction history. Public explorers can't render any of this — Canton never delivers app transactions to non-stakeholders — so the app itself is the explorer, served by a node entitled to see the data.

## Deployed IDs & Links

| Asset | Value |
|---|---|
| Frontend (Vercel) | https://nelva-ashy.vercel.app |
| Backend gateway (Railway) | https://nelva-production.up.railway.app |
| Canton DevNet JSON Ledger API | https://ledger-api.validator.devnet.sandbox.fivenorth.io (5North shared validator) |
| Global synchronizer | `global-domain::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a` |
| nelva-sc **0.3.0** (current) — main package id | `173191343a5615bf6e612796886f52e59b668277985a117c7d4299b8832af7ce` |
| nelva-sc 0.2.0 (compatible-upgrade pair, still vetted) | `27da556acd65944ceb385c82fa94c3a64551b9bb263ad4668eaa55e9ba8e21c9` |
| GitHub | https://github.com/alventendrawan123/nelva |

## Privacy & Integrity Boundaries

| # | Boundary | Where it's enforced |
|---|---|---|
| 1 | Lender ↔ rival lenders (rate secrecy) | Canton projection: `SealedBid` observers are operator + auditor only. Rivals' nodes never receive it. |
| 2 | Co-funder ↔ co-funder (tick secrecy inside one loan) | `Loan` excludes lenders from its observers; each lender gets only its own `LoanPosition`. |
| 3 | Operator ↔ everyone (match honesty) | Twice: the auditor's on-ledger `Verify` recompute (detect), and `Accept`'s re-validation assertion (prevent — a dishonest match cannot settle). |
| 4 | Operator ↔ user funds (custody) | Atomic settlement inside `Accept`/`Repay`; the operator authorizes movements via choices but never holds user funds. |
| 5 | Public ↔ single participant (aggregate leakage) | k-anonymity in the market API: any volume backed by fewer than 2 distinct parties is suppressed. |
| 6 | App ↔ user keys | The ed25519 key is generated and kept in the browser; the BE relays only prepared-transaction hashes and signatures (interactive submission). |

## Honest Limitations

- **Demo oracle** — `PriceUpdate` is signed by an app-controlled Oracle party. Production would bind an external feed (e.g. Chainlink on Canton).
- **Operator is still the matcher** — Nelva makes cheating *detectable and unsettleable*, not impossible to attempt. Liveness (running the match at all) remains the operator's job.
- **Dev auth on the gateway** — the REST layer trusts a `Bearer <party>` header for read scoping; fine for a demo, not a production auth story. Ledger writes are always protected by real signatures regardless.
- **Shared DevNet** — the validator is 5North's shared sandbox; transient connect-timeouts are retried, and party hints are prefixed (`nelva-`) to avoid collisions with other teams.
- **Single seeded market** — the demo runs on a test `USD` instrument minted by a faucet; the swap + multi-instrument plumbing exists but ships with one market seeded.

## Hackathon Submission

| | |
|---|---|
| Event | Encode Club — **Build on Canton** hackathon |
| Track | Track 1 · Private DeFi & Capital Markets |
| Live demo | https://nelva-ashy.vercel.app |
| Demo video | *(added with submission)* |
| Repo | https://github.com/alventendrawan123/nelva |
| Team | Alven (smart contracts + backend) · Bima (frontend) · Jeje (video/deck) |

## License

Apache-2.0

---

**Bid privately. Match deterministically. Verify on-ledger. Nelva.**
