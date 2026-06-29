# Nelva

**Private sealed-bid lending on Canton — with matching you can prove was honest.**

Built for the Encode *Build on Canton* hackathon · Track 1: Private DeFi & Capital Markets.

---

## The problem

Institutional lending runs on private terms. A lender's rate, a borrower's position, and who is matched with whom are commercially sensitive — leaking them invites front-running and price discovery against you. But the usual fix (a trusted operator who keeps everything secret) asks everyone to *believe* the operator matched fairly. On a public chain you get auditability but no privacy; with a private operator you get privacy but no proof.

## What Nelva does

Nelva is a private, sealed-bid peer-to-peer lending market on **Canton**:

- **Lenders post sealed bids** — an amount at a reservation rate. No competitor, and not even the operator, can read another lender's rate.
- **The operator runs one deterministic match** — cheapest capital fills each borrow first; the borrower pays a single blended rate while each lender keeps its own rate (discriminatory pricing).
- **An auditor proves honesty** — it re-runs the exact same deterministic match over *every* sealed bid (winners and losers) and stamps the proposal **GREEN** (published match equals the recompute) or **RED** (it doesn't). Privacy is preserved *and* a cheating operator is caught.

Private like an OTC desk, provable like a public chain — without putting anyone's rate on a public ledger.

## The hero: the Lens

The **Lens** shows one matched loan through five perspectives at once:

| Party | Sees |
|---|---|
| Lender | only its own bid |
| Borrower | only its own loan + blended rate |
| Operator | all bids (runs the match) |
| Auditor | all bids (proves the match) |
| Outsider | public totals only — no bids, no rates, no identities |

These are not UI tricks. Each perspective is a **real per-party projection from the Canton ledger** — the privacy is enforced by the protocol, not the frontend. Run an honest match → auditor verifies GREEN. Run "Cheat Match" (operator secretly skips a cheaper lender) → auditor flips RED, with the reason.

## Why Canton

Canton is a privacy-enabled Layer 1 where transactions stay private between the parties involved and multi-party workflows settle atomically. That maps directly onto this problem:

- **Sub-transaction privacy** — each party's query returns only the slice it is a stakeholder on. No encryption bolt-on, no off-chain trusted compute.
- **Atomic settlement** — funds move from lenders to borrower in a single transaction; no operator ever custodies the money.
- **Signatory-based authorization** — who can do what is the contract's signatories, not a hot key.

## Architecture

```
Frontend (Next.js)  ──REST──▶  Backend gateway (Node/TS)  ──JSON Ledger API v2──▶  Canton
  persona views,                thin, stateless;                                    Daml contracts:
  the Lens, the demo            no database — the ledger                            Asset / Lending /
                                is the single source of truth                       Settlement / Credit / Match
```

- **Smart contracts** (`sc/`) — Daml: sealed bids, deterministic matching, collateralised loans, repay/liquidate, and the auditor's verify. The matching logic is pure and re-runnable, which is what makes audit possible.
- **Backend** (`be/`) — a thin Node/TS gateway over the Canton JSON Ledger API v2. **No database** — every read and write goes through Daml choices, so there is no second source of truth that can drift from the ledger. Runs in `mock` mode (in-memory, for fast FE dev) or `canton` mode (real ledger).
- **Frontend** (`frontend/`) — Next.js; a persona switcher to experience all five perspectives, the Lens, and the live lend/borrow/match/verify flow.

## Tech stack

Daml (SDK 3.4) · Canton JSON Ledger API v2 · Node / TypeScript / Express · Next.js 16 / React 19 / TanStack Query / Tailwind · Docker (BE + Canton sandbox, one container) · Railway + Vercel.

## Run it locally

**Smart contracts + ledger**
```bash
cd sc
dpm build
dpm sandbox --json-api-port 7575 --dar .daml/dist/nelva-sc-0.1.0.dar
```

**Backend** (real Canton)
```bash
cd be
npm install
LEDGER_MODE=canton JSON_LEDGER_API=http://localhost:7575 npm start
# or LEDGER_MODE=mock for an in-memory ledger (no sandbox needed)
```

**Frontend**
```bash
cd frontend
pnpm install
pnpm dev   # http://localhost:3000
```

## Deploy

The backend ships with a Dockerfile that runs the Canton sandbox **and** the gateway in one container, so it deploys as a single Railway service with the Next.js frontend on Vercel. See [docs/DEPLOY.md](docs/DEPLOY.md).

## Project layout

```
sc/        Daml smart contracts + tests
be/        Node/TS gateway (mock + real Canton), Dockerfile, entrypoint
frontend/  Next.js app (the Lens, personas, lend/borrow/match/verify)
docs/      PRD, technical spec, user flow, deploy guide, pitch script
```

## Honest status

- The lending core — sealed bids, deterministic matching, atomic settlement, per-party privacy, and the auditor's GREEN/RED proof — is **real on Canton** and covered by smart-contract tests.
- The live deployment runs Canton in **sandbox mode** (a real single-participant ledger with real per-party privacy), not the shared public DevNet; the ledger endpoint is swappable to a DevNet validator via environment only, no code change.
- The persona switcher is a demo affordance for experiencing the five perspectives; production authentication is OIDC/JWT (the gateway already carries the OAuth2 client-credentials plumbing).

## Team

Alven (smart contracts + backend) · Bima (frontend) · Jeje (design + video).
