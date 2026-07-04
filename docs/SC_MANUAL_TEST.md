# Nelva — Manual Test Checklist (fungsi SC di DevNet 5N)

**Target:** `https://nelva-production.up.railway.app` (BE publik → DevNet 5N, live).
**Auth (dev):** header `Authorization: Bearer <NamaParty>`. Party valid: `Operator`, `Auditor`,
`Oracle`, `LenderA`, `LenderB`, `Borrower`.
**Tools:** Postman (import URL) atau `curl`. Di **PowerShell pakai `curl.exe`** (bukan `curl` alias).

> Tiap endpoint di BE mengeksekusi **choice SC** di baliknya (kolom "SC choice"). Jadi lolos
> endpoint = choice SC-nya jalan di ledger DevNet. Holding.Lock/Split/DrawLocked/dll dipanggil
> otomatis di dalam bid/accept/repay (lihat §6 buat tes Holding langsung via Seaport, 1 party).

Auto-matcher operator jalan tiap 20s — habis post bid+borrow, proposal muncul sendiri (atau paksa `run-match`).

---

## §1 Happy path (urut) — inti settlement

| ✓ | Langkah | Call | SC choice | Harapan |
|---|---|---|---|---|
| ☐ | 1. Lender A pasang bid | `POST /api/bids` Bearer **LenderA** body `{"amount":100,"rate":0.03}` | Holding.Lock + create SealedBid | 201, balik `bidId`, `status:"OPEN"` |
| ☐ | 2. Lender B pasang bid | `POST /api/bids` Bearer **LenderB** body `{"amount":50,"rate":0.05}` | Holding.Lock + SealedBid | 201 |
| ☐ | 3. Borrower buat intent | `POST /api/borrow` Bearer **Borrower** body `{"amount":150,"maxRate":0.06,"collateralAmount":300}` | Holding.Lock + BorrowIntent | 201, balik `tier`, `requiredCollateral` |
| ☐ | 4. Operator jalankan match | `POST /api/admin/run-match` Bearer **Operator** | **MatchRound.RunMatch** | 200, `proposals:[…]` dgn `blendedRate` + `ticks` per-lender |
| ☐ | 5. Borrower lihat proposal | `GET /api/proposals` Bearer **Borrower** | (read) | proposal `PENDING`, `ticks` LenderA 0.03 + LenderB 0.05 |
| ☐ | 6. Borrower terima | `POST /api/proposals/{proposalId}/accept` Bearer **Borrower** | **MatchProposal.Accept** (→ SealedBid.DrawForMatch, Holding.DrawLocked, LoanPosition) | 200, Loan `status:"ACTIVE"` |
| ☐ | 7. Borrower lunasi | `POST /api/loans/{loanId}/repay` Bearer **Borrower** | **Loan.Repay** + CreditScore.BumpUp | 200, `status:"REPAID"`, `newTier` naik |

## §2 Variasi choice (opsional, buat coverage)

| ✓ | Test | Call | SC choice | Harapan |
|---|---|---|---|---|
| ☐ | Tolak proposal | `POST /api/proposals/{id}/reject` Bearer **Borrower** | **MatchProposal.Reject** (Holding.DrawLockedAmount) | 200, `REJECTED`; bid balik OPEN |
| ☐ | Batal borrow | `DELETE /api/borrow/{borrowId}` Bearer **Borrower** | **BorrowIntent.Cancel** | 200, collateral balik ke borrower |
| ☐ | Tarik bid | `DELETE /api/bids/{bidId}` Bearer **LenderA** | **SealedBid.WithdrawBid** | ⚠️ SC-gated: **hanya sesudah deadline**. Sebelum deadline → ditolak (benar) |
| ☐ | Klaim kelebihan collateral | `POST /api/loans/{loanId}/claim-excess` Bearer **Borrower** | **Loan.ClaimExcess** | 200, `excessReturned` > 0 (butuh collateral > required + harga oracle fresh) |
| ☐ | Likuidasi (unhealthy) | dulu turunkan harga: `POST /api/admin/price` Bearer **Operator** body `{"instrument":"USD","price":0.1}` → lalu `POST /api/admin/liquidate/{loanId}` Bearer **Operator** | **Loan.Liquidate** + CreditScore.BumpDown | 200, `LIQUIDATED`. (Harga normal → ditolak "healthy", itu benar) |

## §3 Swap (butuh 2 harga instrumen)

| ✓ | Test | Call | SC choice | Harapan |
|---|---|---|---|---|
| ☐ | Set harga USD + EUR | `POST /api/admin/price` Bearer **Operator** body `{"instrument":"USD","price":1.0}` lalu `{"instrument":"EUR","price":1.1}` | create PriceUpdate | 200 |
| ☐ | Quote swap | `GET /api/swap-quote?instrumentIn=USD&instrumentOut=EUR&amountIn=10` | (read harga) | 200, `amountOut`, `rate` |
| ☐ | Swap | `POST /api/swap` Bearer **LenderA** body `{"instrumentIn":"USD","instrumentOut":"EUR","amountIn":10}` | **SwapPool.Swap** (Holding.Split) | 201, `amountOut`. Saldo kurang → 400 (benar, ga nge-mint) |

## §4 Audit (differentiator)

| ✓ | Test | Call | SC choice | Harapan |
|---|---|---|---|---|
| ☐ | Auditor lihat semua bid | `GET /api/audit/bids` Bearer **Auditor** | (read privileged) | semua sealed bid + rate-nya |
| ☐ | Verify proposal | `POST /api/audit/verify/{proposalId}` Bearer **Auditor** | **VerifyRequest.Verify** → AuditBadge | 200, `verdict:"GREEN"` (match jujur) |
| ☐ | Lihat badge | `GET /api/audit/badges` Bearer **Auditor** | (read) | badge `GREEN`/`RED` |

## §5 Privacy checks (INI JUAL UTAMA — wajib demo)

| ✓ | Test | Call | Harapan |
|---|---|---|---|
| ☐ | Lender **ga** liat rate rival | `GET /api/lender-status/LenderA` Bearer **LenderA** | cuma bid/loan LenderA. TIDAK ada rate LenderB |
| ☐ | Lens penuh (operator) | `GET /api/lens?proposalId={id}` Bearer **Operator** | 5 perspektif (lender/borrower/operator/auditor/outsider) |
| ☐ | Lens anon = outsider | `GET /api/lens?proposalId={id}` **tanpa** Bearer | cuma `outsider` (status doang), TIDAK ada rate |
| ☐ | Scrape data orang lain ditolak | `GET /api/borrower-status/Borrower` Bearer **LenderA** | 403 forbidden |
| ☐ | Market agregat aman | `GET /api/market` (tanpa auth) | volume agregat, TIDAK ada identitas/rate individual (k-anonymity, <2 party → null) |

## §6 Tes Holding langsung via Seaport (1 party, opsional)

Seaport login = party Loop wallet kamu. Bisa tes template yang signatory = party kamu:
```
Create  Nelva.Asset:Holding { custodian=<kamu>, owner=<kamu>, amount="100.0", instrument="USD", locker=null }
Exercise Split            { splitAmount: "40.0" }        → 2 Holding: 40 + 60
Exercise Lock             { newLocker: <kamu> }          → locker terisi
Exercise Unlock           {}                             → locker null lagi
```
Flow multi-party (RunMatch/Accept/Repay) **tidak** praktis manual di Seaport (butuh banyak party + hak actAs) — pakai §1–§5 lewat BE URL.

---

## Contoh curl (copy-paste)

```bash
BASE=https://nelva-production.up.railway.app
# 1. bid
curl -s -X POST "$BASE/api/bids" -H "Authorization: Bearer LenderA" -H "Content-Type: application/json" -d '{"amount":100,"rate":0.03}'
# 4. run match
curl -s -X POST "$BASE/api/admin/run-match" -H "Authorization: Bearer Operator"
# 5. lihat proposal (ambil proposalId dari sini)
curl -s "$BASE/api/proposals" -H "Authorization: Bearer Borrower"
# 6. accept  (ganti {id})
curl -s -X POST "$BASE/api/proposals/{id}/accept" -H "Authorization: Bearer Borrower"
# 7. repay   (ganti {loanId})
curl -s -X POST "$BASE/api/loans/{loanId}/repay" -H "Authorization: Bearer Borrower"
```
> PowerShell: ganti `curl` → `curl.exe`, dan quote body pakai `'{\"amount\":100,\"rate\":0.03}'`.
