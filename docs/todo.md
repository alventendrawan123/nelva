# Nelva — TODO

## Polish / UX (quick wins)
- [ ] **"Matching…" pending state** — after submitting a bid/borrow there's NO indicator that matching is running; the proposal just appears ~20s later. Show a "⏳ Matching… (~20s)" state in the Match-proposals area (+ "X locked") so the user knows it's working, not stuck. (UX feedback from live E2E.)
- [ ] **FE collateral validation** — warn/block when collateral < 2× borrow (Bronze) *before* submit, instead of failing at Accept with "Loan precondition violated". (found during E2E: collateral 1 submits + matches but Accept is rejected on-ledger.)
- [ ] **Fix copy** — "Your rate is encrypted and hidden from rival lenders" is the old encrypted-TEE framing. On Canton it's not encrypted; rename to "sealed / private" (native sub-transaction privacy, no encryption/TEE).
- [ ] **Bid/loan ↗ link** — the external-link icon points at a ledger explorer that doesn't exist for the sandbox → does nothing. Disable it (or wire to a real explorer when on DevNet).
- [ ] **"New Wallet" button** — let a user wipe the embedded key and create a fresh identity (current Disconnect re-attaches to the same wallet).
- [ ] (optional) **Connect modal** — small dialog on Connect ("Creating your Canton wallet in this browser → Party … → +200 nUSD") so the instant embedded-wallet connect is clearer to judges.

## Features (finish the lifecycle)
- [ ] **Lens → "Proof" page** — move the 5-perspective + auditor GREEN/RED into a dedicated Transparency/Proof page (the differentiator), instead of a Home tab.

## Production pivot (2026-07-01, in progress — real wallet + DevNet)
- [x] **Repay-via-wallet** — borrower repays wallet-signed, pays lenders + interest from OWN funds (not minted), reclaims collateral, tier up. BE `/wallet/repay-info` discloses CreditScore + collateral escrow. Tested 7/7 (real funds move).
- [x] **Reject-via-wallet** — borrower walks away wallet-signed, 5% collateral slashed to operator, 95% returned unlocked. Tested 4/4.
- [x] **dApp-SDK foundation** — `@canton-network/dapp-sdk` v1.3.0 + `frontend/src/lib/wallet/canton.ts` (RemoteAdapter/Extension, connect/listAccounts/prepareExecute), gated by `NEXT_PUBLIC_CANTON_GATEWAY_URL`. tsc-clean.
- [ ] **DevNet validator + Wallet Gateway** — host a real Canton validator (SV sponsor + IP allowlist, or NaaS) + a Wallet Gateway the dApp-SDK RemoteAdapter targets, so judges connect a real CIP-0103 wallet with NO local node. Runbook research in flight. See [[nelva-real-wallet-devnet]].
- [ ] **FE dual-connect** — wire canton.ts into the connect picker + swap submit to prepareExecute when a Canton wallet is connected (only after the gateway URL exists).
- [ ] **Inbound JWT/OIDC auth** — replace the embedded-session bearer with verified per-user JWT / the wallet-writes-only-reads split for a network-exposed deployment.

## Notes
- Live sandbox is **ephemeral** — resets on every Railway redeploy (fresh seed). Fine for demo; not persistent.
- Auto-match runs every ~20s (operator, BE). runMatch now skips bids/borrows already in a pending proposal (no duplicate-proposal churn).

## Done ✅
- Real Canton SC + BE + FE (zero-mock).
- Embedded Ed25519 wallet (browser-held key, external-party signing via interactive submission).
- Connect → real party + 200 nUSD faucet · reconnect re-attaches.
- Lend + Borrow + Accept — all wallet-signed, verified end-to-end on the live Railway BE.
- Auto-matching engine. Single-user UX (all tabs on connect, persona hidden).
- Live on Railway (BE + Canton) + Vercel (FE).
