# Nelva — Technical Specification

> Stack, arsitektur, Daml model, dan **API contract (BE↔FE)**. Bagian §5 (API) + §6 (Lens) = yang paling penting buat Bima.

---

## 1. Tech stack (PINNED — jangan ganti tanpa alasan)
| Layer | Tech | Pin / catatan |
|---|---|---|
| **SC** | Daml | SDK/runtime **3.4.11**, tooling **DPM**, scaffold cn-quickstart. Build: `dpm build`, test: `dpm test`. |
| **Ledger** | Canton | LocalNet (3-participant) via WSL2; live net 3.5.x tapi DAR di-compile 3.4.11. |
| **BE** | Node + TypeScript | klien off-ledger ke **JSON Ledger API v2**. `openapi-fetch@0.17.0` + `openapi-typescript` (dari `/docs/openapi`) + `dpm codegen-js` (`@daml/types@3.5.2`). |
| **BE auth** | Keycloak | JWT per-party (OAuth2 client_credentials). |
| **FE** | React 18.3.1 + Vite 6.4.2 + TS 5.9.3 | Tailwind + shadcn/ui. Panggil BE gateway via `fetch`/`openapi-fetch`. **TIDAK** menyentuh blockchain langsung. |
| **JANGAN** | ❌ `@daml/ledger`, `@daml/react` (2.10.4, mati) · ❌ EVM/Solidity apa pun · ❌ Daml Triggers (deprecated) | |

---

## 2. Arsitektur sistem
```
            ┌────────────────────────────────────────────────────────┐
  Bima ───► │  FRONTEND  (React+Vite+TS)                              │
            │  - Dashboard Lender/Borrower                            │
            │  - LENS party-perspective-diff  ◄── fitur hero          │
            │  - Auditor console (badge MERAH/HIJAU)                  │
            └───────────────┬────────────────────────────────────────┘
                            │  HTTPS REST (JSON)  — API contract §5
            ┌───────────────▼────────────────────────────────────────┐
  Alven ──► │  BE GATEWAY  (Node/TS)  — read/query + bots             │
            │  - terjemah REST ⇄ JSON Ledger API v2                   │
            │  - JWT per-party (Keycloak)                             │
            │  - bots: Operator (RunMatch), Oracle (PriceUpdate)      │
            └───────────────┬────────────────────────────────────────┘
                            │  JSON Ledger API v2  (port 7575, /v2/...)
            ┌───────────────▼────────────────────────────────────────┐
  Alven ──► │  CANTON LEDGER (Daml)  — semua logika & nilai & privasi │
            │  Holding · SealedBid · BorrowIntent · MatchRound        │
            │  MatchProposal · Loan · PriceUpdate · VerifyRequest ·   │
            │  AuditBadge · CreditScore                               │
            └────────────────────────────────────────────────────────┘
```
**Prinsip:** semua kebenaran (matching, otorisasi, uang, privasi) ada **on-ledger di Daml**. BE **tipis** — cuma terjemah + submit + baca. FE cuma render.

---

## 3. Alur data end-to-end
```
1. MINT       custodian buat Holding (cash lender / collateral borrower)
2. SEALED BID lender: Holding.Lock(→operator) + create SealedBid (rate rahasia)
   BORROW     borrower: Holding.Lock + create BorrowIntent
3. RUN MATCH  operator: MatchRound.RunMatch → runDeterministicMatch (pure) → MatchProposal
              (commit SEMUA bid termasuk yang KALAH + proposalId deterministik)
4. ACCEPT     borrower: MatchProposal.Accept (ATOMIK, 1 tx):
              per lender → SealedBid.DrawForMatch (dana lender → borrower, cek rate≤bid)
              + escrow collateral + create Loan (ensure collateral≥required)
5a. REPAY     borrower: Loan.Repay → bayar tiap lender (principal+bunga) → naik tier
5b. LIQUIDATE oracle PriceUpdate → operator Loan.Liquidate (health<1.5 / jatuh tempo)
              → seize collateral + fee 5% + pro-rata ke lender (dust→lender terakhir)
6. AUDIT      auditor: VerifyRequest.Verify(semua bidCid) → re-run match deterministik
              → cocok = AuditBadge HIJAU ; beda/skip = MERAH
```

---

## 4. Daml model (ringkas — detail di `d:\nelva\sc\daml\Nelva\`)
| Template | Signatory | Observer | Choice kunci |
|---|---|---|---|
| `Holding` | custodian | owner, locker | Lock, Unlock, Transfer, DrawLocked |
| `SealedBid` | lender | operator, auditor | DrawForMatch(rate,recipient), WithdrawBid |
| `BorrowIntent` | borrower | operator, auditor | — |
| `MatchRound` | operator | auditor | RunMatch(bidCids,borrowCids) |
| `MatchProposal` | operator | borrower, auditor, lenders | **Accept**, Reject |
| `Loan` | borrower, operator | auditor, lenders | Repay, Liquidate(priceCid) |
| `PriceUpdate` | oracle | operator | — |
| `VerifyRequest` | auditor | — | **Verify(allBidCids)** |
| `AuditBadge` | auditor | operator, borrower, lenders | — |
| `CreditScore` | operator | borrower | (upgrade/downgrade in logic) |

Inti deterministik: satu modul pure `runDeterministicMatch` dipakai SAMA oleh `RunMatch` (operator) & `Verify` (auditor) → hasil byte-identik = dasar badge MERAH/HIJAU. Privasi = signatory/observer (rival bukan observer → tak lihat bid). Numeric 10 (bukan float). Keys 3.x tak dipakai (single-active di business logic).

---

## 5. API CONTRACT (BE ⇄ FE)  ◄── BIMA BACA INI
Base URL (dev): `http://localhost:8090/api` (8080 sering dipakai Apache/XAMPP). Semua butuh header `Authorization: Bearer <token>`.
Format: JSON, **camelCase**. Angka uang = string desimal (hindari float JS), mis. `"100.0"`.

### 5.0 Auth (dev simpel)
```
POST /api/login            body { party: "Lender" | "Borrower" | "Operator" | "Auditor" }
  → 200 { token, party, role }
GET  /api/me               → { party, role }
```
*(Dev: pilih party = pilih sudut pandang. Produksi: Keycloak login beneran.)*

### 5.1 Lender
```
POST /api/bids             { amount:"100.0", rate:"0.05", instrument:"USD", durationDays:30 }
  → 201 { bidId, status:"OPEN", lockedHoldingId }
GET  /api/bids             → Bid[]            (hanya bid milik sendiri — privasi)
DELETE /api/bids/:bidId    → { status:"WITHDRAWN" }   (setelah deadline)
```

### 5.2 Borrower
```
POST /api/borrow           { amount:"150.0", maxRate:"0.06", collateralAmount:"300.0", instrument:"USD" }
  → 201 { borrowId, tier:"Bronze", requiredCollateral:"300.0" }
GET  /api/borrow           → BorrowIntent[]   (milik sendiri)
GET  /api/proposals        → MatchProposal[]  (yang ditujukan ke saya)
POST /api/proposals/:id/accept   → { loanId }            (ATOMIK)
POST /api/proposals/:id/reject   → { status:"REJECTED" } (slash 5%)
GET  /api/loans            → Loan[]
POST /api/loans/:id/repay  → { status:"REPAID", newTier:"Silver" }
```

### 5.3 Operator (admin / demo controls)
```
POST /api/admin/run-match          → { proposalIds:[...] }
POST /api/admin/price              { instrument:"ETH", price:"2000.0" }  → { priceUpdateId }
POST /api/admin/liquidate/:loanId  → { status:"LIQUIDATED", distribution:[...] }
POST /api/admin/cheat-match        (DEMO ONLY) → bikin match curang utk picu MERAH
```

### 5.4 Auditor
```
GET  /api/audit/bids               → Bid[]   (SEMUA bid termasuk yang KALAH)
POST /api/audit/verify/:proposalId → { verdict:"GREEN"|"RED", expected:{...}, actual:{...}, reason }
GET  /api/audit/badges             → AuditBadge[]
```

### 5.5 Status publik (orang luar / juri)
```
GET  /api/status   → { openBids:int, activeLoans:int, lastMatchAt, solvency? }   (TANPA bid/posisi)
```

### 5.6 Bentuk objek (response)
```jsonc
Bid            { bidId, lender, amount, rate?, instrument, status, deadline }   // rate null kalau bukan kamu/auditor
BorrowIntent   { borrowId, borrower, amount, maxRate, tier, requiredCollateral, instrument }
MatchProposal  { proposalId, borrower, principal, blendedRate, ticks:[Tick], status }
Tick           { lender, bidId, amount, rate }    // discriminatory: rate = bunga lender itu sendiri
Loan           { loanId, borrower, principal, ticks:[Tick], collateralAmount, maturity, status }
AuditBadge     { proposalId, verdict:"GREEN"|"RED", auditor, checkedAt }
```

---

## 6. Lens API (fitur hero) ◄── BIMA: ini yang bikin demo menang
Satu endpoint mengembalikan **data sama** diproyeksikan untuk TIAP sudut pandang, supaya FE render diff side-by-side:
```
GET /api/lens?proposalId=<id>
→ {
    subject: { proposalId, borrower, principal },
    perspectives: {
      lender:   { canSee:["ownBid","ownTick","loan"],  bids:[{rate:"0.05",...}], ... },
      borrower: { canSee:["ownIntent","proposal","loan"], proposal:{...}, ... },
      operator: { canSee:["allBids","proposal"], bids:[/* SEMUA + rate */], proposal:{...} },
      auditor:  { canSee:["allBids","proposal","verdict"], bids:[/* SEMUA incl loser */], badge:{verdict} },
      outsider: { canSee:["status"], status:{...} }     // TIDAK ada bid/rate/posisi
    }
  }
```
**Aturan render Lens (penting):** jangan filter di FE buat "privasi". Privasi itu **datang dari ledger** (BE baca per-party). FE cuma menampilkan apa adanya per perspektif. Warnai: hijau = sama-sama lihat, kuning = cuma 1 yang lihat, abu = disembunyikan.

---

## 7. BE → Canton (JSON Ledger API v2) — referensi Alven
- `POST /v2/commands/submit-and-wait` — create/exercise (otoritas dari party JWT).
- `POST /v2/state/active-contracts` (`filtersByParty`) — baca per-party (untuk Lens + list).
- `GET /v2/state/ledger-end` lalu `POST /v2/updates` — stream untuk operator loop.
- Explicit disclosure: `includeCreatedEventBlob:true` + `disclosed_contracts` (auditor lihat bid lintas-participant).
- camelCase di JSON; JWT wajib tiap call; port 7575. Detail: `d:\nelva\be\skill.md`.

---

## 8. Caveat teknis (lihat juga PRD §8)
Operator lihat bid (bukan TEE) · auditor pakai shared key utk cleartext · oracle harga di-mock · dana lock saat bid · keys Daml 3.x tak dipakai · hash commitment dihitung off-ledger (DA.Crypto.Text alpha).
