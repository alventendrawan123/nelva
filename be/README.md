# Nelva BE (gateway)

Thin REST gateway for Nelva. Talks to the real Canton JSON Ledger API
(`src/ledger.canton.ts`) — the smart contracts (Daml) hold all correctness, matching,
authorization, and money logic; this backend just builds ledger commands and projects
party-scoped reads. Live on 5N DevNet (`https://nelva-production.up.railway.app`).

## Run
Needs a Canton ledger (dpm sandbox on :7575, or 5N DevNet). Copy `.env.example` → `.env`
and fill it (see the "5N DevNet" block for the live setup).
```bash
cd be
npm install
npm run dev        # http://localhost:8090  (auto-seeds demo data on boot)
```
Health: `GET /api/status` · `GET /api/health`

## Auth (dev)
Pick a party = pick a perspective. `POST /api/login {"party":"LenderA"}` → `{token}`.
Send `Authorization: Bearer <party>` on subsequent calls.
Parties: `LenderA`, `LenderB`, `Borrower`, `Operator`, `Auditor`, `Oracle`.

## Endpoints
See **docs/2_TECH_SPEC §5** (API contract) and **§6** (Lens). Summary:
- Lender: `POST/GET /api/bids`, `DELETE /api/bids/:id`
- Borrower: `POST/GET /api/borrow`, `GET /api/proposals`, `POST /api/proposals/:id/accept|reject`, `GET /api/loans`, `POST /api/loans/:id/repay`
- Operator: `POST /api/admin/{run-match,cheat-match,price,liquidate/:loanId,seed}`
- Auditor: `GET /api/audit/bids`, `POST /api/audit/verify/:proposalId`, `GET /api/audit/badges`
- Hero: `GET /api/lens?proposalId=...` · Public: `GET /api/status`

## Demo flow (curl)
```bash
B=http://localhost:8090/api
curl -H "Authorization: Bearer Operator" -XPOST $B/admin/run-match          # -> proposal (honest, on-ledger)
curl -H "Authorization: Bearer Auditor"  -XPOST $B/audit/verify/<id>        # -> GREEN
curl -H "Authorization: Bearer Operator" -XPOST $B/admin/cheat-match        # dishonest proposal
curl -H "Authorization: Bearer Auditor"  -XPOST $B/audit/verify/<cheatId>   # -> RED  (money shot)
curl -H "Authorization: Bearer Operator" "$B/lens?proposalId=<id>"          # 5 perspectives for the diff
```

## Notes
- Amounts/rates go to the ledger as string decimals (Daml Numeric), never floats.
- `src/match.ts` = cheat-match helper only (the demo RED path); the honest match runs on-ledger (`Nelva.Settlement:RunMatch`).
- Privacy is native Canton sub-transaction projection (party-scoped reads), not FE filtering.
