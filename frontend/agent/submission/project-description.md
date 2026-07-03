# Nelva, Project Description (Submission)

Ready-to-paste copy for the Encode "Build on Canton" submission form. Track: Track 1, Private DeFi and Capital Markets.

---

## Project Name
Nelva

---

## Project Description, SHORT (1 line, for the "brief high-level summary" field)

Nelva is a private peer-to-peer lending market on Canton where lenders bid interest rates in secret, and an auditor can prove every match was honest without ever opening a single bid.

---

## Project Description, MEDIUM (1 paragraph)

Nelva is a private, sealed-bid peer-to-peer lending market built natively on Canton. Lenders submit interest-rate bids that rivals cannot see, because the privacy comes from Canton's own signatory and observer model rather than from encryption. A deterministic on-ledger engine matches lenders to borrowers cheapest first, and borrowers accept in a single atomic transaction with no operator holding the money. What makes Nelva different is the auditor. An independent auditor can re-run the exact same match over all of the bids, including the ones that lost, and prove the operator was honest. If the match is honest the auditor shows a green badge. If the operator cheated by skipping a cheaper lender, the badge turns red. The market stays private, but a cheater still gets caught.

---

## Project Description, LONG (full submission body)

Nelva is a private peer-to-peer lending market on Canton. It is an observe-imitate-modify rebuild of GHOST Finance, a DeFi-prize winner that runs on EVM using TEEs. We rebuilt it on Canton with native privacy, plus one thing GHOST cannot do: matching that anyone can audit.

### The problem
In ordinary DeFi lending like Aave or Compound, everything is public. Rates, positions, and collateral are all visible. That causes three problems.

First, front-running. Bots watch the pending bids in the mempool, sandwich them, and drain value. Second, free-riding on pooled rates. Everyone earns the pool average, so there is no reason to bid honestly and price discovery breaks down. Third, naked positions. Visible collateral and liquidation thresholds invite liquidation attacks and let competitors spy on you.

GHOST fixes this on EVM with a TEE, which is a secret enclave. But because the TEE erases everything and the match id is random, no one can re-verify that the match was honest. You can only trust the black box.

### What Nelva does
Lenders submit secret interest-rate bids, and rivals cannot see each other's bids because the privacy is structural, not encryption.

Each lender earns their own rate, which is called discriminatory or pay-as-bid pricing. That makes honest bidding the best strategy.

A greedy "cheapest lend first" algorithm runs on-ledger as a deterministic Daml choice, so the same inputs always give the same result.

The differentiator is auditable matching. An auditor re-executes the same match over all of the bids, including the losing ones. If the result matches, the badge is green. If a cheating operator skipped a cheaper lender, the badge is red. GHOST cannot do this.

Borrowers also get credit tiers from Bronze up to Platinum, which become more collateral-efficient over time, plus collateral and automatic liquidation when a loan becomes unhealthy.

Finally there is the Lens, our hero visual. The lender, borrower, operator, auditor, and an outside observer each see different data from the same ledger, which proves the privacy live on screen.

### Why it wins
Privacy is the core of Nelva, not a bolt-on. That is the killer feature of Canton and it is exactly what Track 1 is about.

Auditability is something no existing Canton winner has.

As a bonus, we fix real GHOST bugs by construction: settlement is atomic, there is no double-credit, over-collateralization is enforced by the ledger, and funds are always conserved.

### Honest caveats
We do not overclaim. The operator can see the bids, so this is not a blind TEE. The guarantee is privacy from rivals plus match honesty through the auditor, not a blind operator. The auditor also needs a shared key to read the cleartext rates, because Canton has no TEE or ZK, and this is an MVP. The price oracle is mocked using operator-signed price updates for the demo. Everything is 100% Canton, with no EVM, no ZK, no FHE, and no real custody or KYC.

### One-line pitch
Private, but still caught if it cheats.

---

## Tech stack (for "technologies used" field)
- Smart contracts: Daml (SDK and runtime 3.4.11, DPM tooling, cn-quickstart scaffold) on Canton LocalNet.
- Backend: Node and TypeScript gateway talking to the JSON Ledger API v2 (openapi-fetch, @daml/types), with Keycloak JWT per party.
- Frontend: React, Vite, TypeScript, Tailwind, and shadcn/ui. It only calls the backend gateway and never touches the chain directly.

## Team
- Alven: smart contracts (Daml) and the backend gateway.
- Bima: frontend (Lens, dashboards, auditor console).
- Jeje: demo video.

## Track
Encode "Build on Canton", Track 1: Private DeFi and Capital Markets.
