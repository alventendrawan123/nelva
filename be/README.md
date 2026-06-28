# Nelva BE (gateway)

Thin backend for Nelva. **Mock-ledger mode** (default) runs fully in-memory — no
Canton needed — so the FE can build against the real REST contract immediately.
Later, swap `src/store.ts` for a JSON Ledger API adapter (`be/skill.md`) to go live.

## Run
```bash
cd be
npm install
npm run dev        # http://localhost:8090  (auto-seeded with demo data)
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
curl -XPOST $B/admin/run-match                                   # -> proposal P-borrow-3 (honest)
curl -H "Authorization: Bearer Auditor" -XPOST $B/audit/verify/<id>   # -> GREEN
curl -XPOST $B/admin/cheat-match                                 # dishonest proposal
curl -H "Authorization: Bearer Auditor" -XPOST $B/audit/verify/<cheatId>  # -> RED  (money shot)
curl "$B/lens?proposalId=<id>"                                   # 5 perspectives for the diff
```

## Notes
- Mock uses JS numbers for amounts (contract recommends string decimals in prod).
- Match/verify logic in `src/match.ts` mirrors `daml/Nelva/Match.daml` 1:1.
- Privacy comes from the store projection (party-scoped reads), not FE filtering.
