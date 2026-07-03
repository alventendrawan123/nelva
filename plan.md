# Plan integrasi Frontend (Phase 4) — untuk Bima

**Owner:** Bima · **Konsumen:** end-users (lender + borrower + auditor + operator/demo) · **Status backend:** security review + SC audit selesai, semua CRITICAL/HIGH ditutup, 44 endpoint real di Canton, 14/14 Daml test + 62 assertion live pass. **DAR package id:** `198e9be8…` (FE baca otomatis dari `/api/config`, tak perlu hardcode).

Dokumen ini **action plan step-by-step**, bukan reference. FE Nelva **sudah ada** (Next.js App Router + TanStack Query + zod, api layer di `src/lib/api/`) — jadi kerjaan utama = **sinkronisasi ke perubahan kontrak API dari hardening keamanan** lalu verifikasi tiap flow live. Bukan bikin dari nol.

> ⚠️ Backend baru saja di-hardening. Beberapa response berubah bentuk. Kalau langsung `pnpm dev` tanpa Phase 4.1, halaman **Lens** dan **profil lender** akan error (zod parse gagal / data kosong). **Kerjakan 4.1 dulu.**

---

## Daftar Isi

1. [Pre-requisite (sekali setup)](#1-pre-requisite-sekali-setup)
2. [Urutan implementasi (P0 → P3)](#2-urutan-implementasi-p0--p3)
3. [Phase 4.1 — Sync kontrak API (WAJIB dulu)](#3-phase-41--sync-kontrak-api-wajib-dulu)
4. [Phase 4.2 — Home: Lend + Borrow + Status](#4-phase-42--home-lend--borrow--status)
5. [Phase 4.3 — Match → Accept/Reject → Repay](#5-phase-43--match--acceptreject--repay)
6. [Phase 4.4 — Lens hero + Audit (verify/badges)](#6-phase-44--lens-hero--audit-verifybadges)
7. [Phase 4.5 — Dashboard lender + collateral-quote + wallet path](#7-phase-45--dashboard-lender--collateral-quote--wallet-path)
8. [Phase 4.6 — Polish + demo prep](#8-phase-46--polish--demo-prep)
9. [Common pitfalls (FAQ)](#9-common-pitfalls-faq)
10. [Definition of Done per halaman](#10-definition-of-done-per-halaman)
11. [Estimasi waktu](#11-estimasi-waktu)
12. [Kontak](#12-kontak)

---

## 1. Pre-requisite (sekali setup)

Lakukan sekali di awal sebelum nyentuh code.

- [ ] **Pull latest dari main**
  ```bash
  git pull origin main
  ```
  Pastikan dapat commit terakhir `fix(sc): per-lender loan privacy …` + `fix(be): lens hero full view for operator/auditor`.

- [ ] **Baca `AGENTS.md` di `frontend/`** — versi Next.js di repo ini **bukan** yang biasa; ada breaking change. Baca guide di `node_modules/next/dist/docs/` sebelum nulis kode Next.js apa pun.

- [ ] **Install + jalankan FE**
  ```bash
  cd frontend
  pnpm install
  pnpm dev
  ```

- [ ] **Set `NEXT_PUBLIC_API_BASE_URL`** di `frontend/.env.local` (gitignored):
  ```
  # lokal (sandbox jalan di WSL):
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8090/api
  # atau prod (Railway):
  # NEXT_PUBLIC_API_BASE_URL=https://nelva-production.up.railway.app/api
  ```
  Default (kalau tak di-set) = `http://localhost:8090/api` (lihat `src/config/env.ts`).

- [ ] **Verify backend hidup**
  ```bash
  curl http://localhost:8090/api/health      # -> {"ok":true,"mode":"canton"}
  curl http://localhost:8090/api/config       # -> {"packageId":"198e9be8...","parties":{...}}
  ```
  Kalau `health` gagal / mode bukan `canton` → kabari Alven (sandbox belum jalan).

- [ ] **Wallet (opsional untuk demo utama):** persona path (Bearer=nama party) sudah cukup untuk seluruh demo. Real Canton wallet (`@canton-network/dapp-sdk`) butuh `NEXT_PUBLIC_CANTON_GATEWAY_URL` — kalau kosong, hanya embedded persona yang muncul di connect picker. **Demo default pakai persona; wallet path itu P3.**

- [ ] **Baca ringkas 3 dokumen** (30–40 menit): `docs/2_TECH_SPEC.md` (kontrak REST §5/§6), `docs/3_USER_FLOW_WIREFRAME.md` (page flow), dan section [Phase 4.1](#3-phase-41--sync-kontrak-api-wajib-dulu) di dokumen ini (daftar perubahan API). Pahami dulu sebelum nulis kode.

---

## 2. Urutan implementasi (P0 → P3)

| Priority | Phase | Fokus | Dependency |
|----------|-------|-------|------------|
| **P0** | 4.1 | Sync kontrak API — schema + lens Bearer + lender-status | — |
| **P0** | 4.2 | Home: Lend / Borrow / Status verify live | 4.1 |
| **P1** | 4.3 | Match → Accept/Reject → Repay (lifecycle) | 4.2 |
| **P1** | 4.4 | Lens hero (privacy demo) + Audit verify/badges | 4.2 |
| **P2** | 4.5 | Dashboard lender (`/lender-status`) + collateral-quote + wallet path | 4.3 |
| **P3** | 4.6 | Polish (loading/error/mobile) + demo prep | semua |

**Kenapa urutan ini?**
- **4.1 dulu, non-negotiable** — tanpa sync schema, Lens & profil lender error. Ini bukan fitur baru, ini "benerin yang barusan berubah di backend".
- **Home (4.2)** menghasilkan bid + borrow yang jadi bahan untuk match (4.3) dan lens (4.4).
- **Lens (4.4)** adalah hero/pitch — butuh minimal 1 proposal (dari 4.3) supaya bermakna.
- **Dashboard lender (4.5)** butuh loan aktif (dari 4.3).

**JANGAN skip 4.1.** Debugging Lens/profil sebelum schema disync = buang waktu.

---

## 3. Phase 4.1 — Sync kontrak API (WAJIB dulu)

**Tujuan:** samakan FE dengan kontrak backend setelah hardening. Semua di `frontend/src/lib/api/`.

### Yang berubah di backend (dan kenapa)

| # | Endpoint | Perubahan | Efek ke FE kalau tak disync |
|---|----------|-----------|------------------------------|
| A | `GET /lens` | **Butuh Bearer** untuk view penuh. Anonim → hanya `perspectives.outsider`. Operator/Auditor → semua 5 perspektif (view demo). | `api.lens` sekarang kirim **tanpa** Bearer → dapat outsider-only → `lensViewSchema` (butuh 5 perspektif) **gagal parse** → Lens error. |
| B | `GET /lender-status/:party`, `/borrower-status/:party`, `/credit-score/:party`, `/collateral-quote` | **Di-gate**: hanya `Bearer == :party` (diri sendiri) atau operator/auditor. | Tanpa Bearer benar → **401/403**. |
| C | `GET /loans` (viewer=lender) | Lender **tak lagi observe Loan** (privasi per-lender). Loan lender pindah ke `/lender-status`. | `useLoans()` untuk lender → `[]`. Profil lender "active loans" kosong. |
| D | `GET /lender-status/:party` shape | `activeLoans[]` = `{ loanId, borrower, maturity, myPrincipal, myRate, owedToMe }` (tanpa `tier`/`myTicks`). | Wajib schema baru saat wiring dashboard lender (4.5). |
| E | `GET /market` | `totalOpenLendVolume`/`totalOpenBorrowVolume`/`avgLoanSize` bisa **`null`** (k-anonymity: <2 peserta). | Kalau nanti dipakai, schema harus `.nullable()`. |
| F | `POST /faucet` | Danai **caller** (Bearer), abaikan `body.party`. | Wallet faucet harus kirim Bearer. |
| G | Error responses | Distandarkan: **401** (no auth), **403** (role/party salah), **409** (contract berubah/race), **502** (ledger down), **400** (validasi). Body tetap `{ "error": "..." }` (sudah disanitasi, tak bocor id internal). | Client existing tetap jalan (`payload.error`), tapi map status ke pesan ramah lebih baik. |

Perubahan **C, D** karena fix privasi per-lender: tiap lender cuma bisa lihat posisi-nya sendiri (rate rival tak bocor). Perubahan **A** karena fix kebocoran Lens anonim.

### Tasks

- [ ] **Fix `api.lens`** (`src/lib/api/endpoints.ts`) — kirim Bearer.
  Untuk hero teaching view, panggil sebagai **Operator** (dapat 5 perspektif penuh; aman karena operator memang berhak lihat semua):
  ```ts
  lens: (proposalId: string, viewer = "Operator") =>
    call<LensView>(`/lens?proposalId=${proposalId}`, {
      party: viewer,            // <-- WAJIB, sebelumnya kosong
      schema: lensViewSchema,
    }),
  ```
  Update `useLens` (`hooks.ts`) kalau perlu terima `viewer`.

- [ ] **Relax `lensViewSchema`** (`src/lib/api/schemas.ts`) — perspektif sekarang **partial** untuk caller non-privileged (mis. lender biasa hanya dapat `lender` + `outsider`). Bikin tiap perspektif `.optional()`:
  ```ts
  export const lensViewSchema = z.object({
    subject: z.object({ proposalId: z.string(), borrower: z.string(), principal: z.number() }).nullable(),
    perspectives: z.object({
      lender:   z.object({ party: z.string().nullable(), canSee: z.array(z.string()), bids: z.array(bidSchema) }).optional(),
      borrower: z.object({ party: z.string().nullable(), canSee: z.array(z.string()), proposal: matchProposalSchema.nullable() }).optional(),
      operator: z.object({ canSee: z.array(z.string()), bids: z.array(bidSchema), proposal: matchProposalSchema.nullable() }).optional(),
      auditor:  z.object({ canSee: z.array(z.string()), bids: z.array(bidSchema), badge: auditBadgeSchema.nullable() }).optional(),
      outsider: z.object({ canSee: z.array(z.string()), status: statusSchema }),   // selalu ada
    }),
  });
  ```
  `LensPanel.tsx` harus guard tiap perspektif (`perspectives.operator?.bids ?? []`).

- [ ] **Tambah endpoint dashboard lender** (`endpoints.ts`) — untuk 4.5, tapi definisikan schema sekarang:
  ```ts
  lenderStatus: (party: string) =>
    call<LenderStatus>(`/lender-status/${party}`, { party, schema: lenderStatusSchema }),
  ```
  Schema baru di `schemas.ts`:
  ```ts
  export const lenderPositionSchema = z.object({
    loanId: z.string(), borrower: z.string(), maturity: z.string(),
    myPrincipal: z.number(), myRate: z.number(), owedToMe: z.number(),
  });
  export const lenderStatusSchema = z.object({
    party: z.string(),
    activeLends: z.array(bidSchema),
    activeLoans: z.array(lenderPositionSchema),
    completedLoans: z.array(z.unknown()),
    pendingPayouts: z.array(z.object({ loanId: z.string(), borrower: z.string(), amount: z.number(), maturity: z.string() })),
  });
  ```

- [ ] **(Opsional, kalau pakai market)** tambah `marketSchema` dengan volume `.nullable()`:
  ```ts
  totalOpenLendVolume: z.number().nullable(),
  totalOpenBorrowVolume: z.number().nullable(),
  avgLoanSize: z.number().nullable(),
  ```

- [ ] **Map error status ke pesan ramah** (`src/lib/api/client.ts`) — opsional tapi enak. Backend sudah kasih `{error}` string; tambah mapping ringan berdasar `response.status`:
  ```
  401 -> "Connect / pilih party dulu."   403 -> "Party ini tak boleh akses data itu."
  409 -> "State ledger berubah, coba lagi."   502 -> "Ledger sedang tidak tersedia."
  ```

### Manual test 4.1

- [ ] `pnpm dev` → buka Home. Tak ada error zod di console.
- [ ] `curl -H "Authorization: Bearer Operator" ".../api/lens"` → JSON punya `perspectives.operator.bids`.
- [ ] `curl ".../api/lens"` (tanpa auth) → hanya `perspectives.outsider` (aman, bukan bug).
- [ ] `curl ".../api/lender-status/LenderA"` (tanpa auth) → **401**; dengan `-H "Authorization: Bearer LenderA"` → **200**.

### DoD 4.1

- [ ] `pnpm build` + `pnpm lint` (biome) hijau.
- [ ] Home load tanpa error console.
- [ ] `lensViewSchema` toleran perspektif partial.
- [ ] Schema `lenderStatus` siap dipakai 4.5.

---

## 4. Phase 4.2 — Home: Lend + Borrow + Status

**Tujuan:** pastikan flow inti (`LendPanel`, `BorrowPanel`, `StatusPanel`) jalan end-to-end lawan BE live. Kode sudah ada (`usePlaceBid`, `useBorrow`, `useStatus`) — ini **verifikasi**, bukan nulis dari nol.

### Target UI (wireframe)

```
┌─ Nelva ───────────────────────────── [Connect: LenderA ▾] ─ [balance] ─┐
│   Sealed-bid P2P lending on Canton                                      │
│   🔒 Rate kamu ter-seal. Lender lain tak lihat. Privasi native, no TEE. │
│                                                                         │
│   ┌─ [·Lend·] [ Borrow ] ───────────────┐   ┌─ Market status ────────┐  │
│   │  Amount (USD)   [ 100        ]       │   │ Open bids       3      │  │
│   │  Your rate (%)  [ 4.0        ]       │   │ Active loans    4      │  │
│   │  🔒 sealed — only you + operator     │   │ Proposals       1      │  │
│   │  [    Place sealed bid    ]          │   │ Last match   12:04     │  │
│   └──────────────────────────────────────┘   └────────────────────────┘  │
│                                                                         │
│   ── Borrow tab ──                                                      │
│   ┌─ [ Lend ] [·Borrow·] ───────────────────────────────┐              │
│   │  Amount 150 · Max rate 6.0% · Collateral [ 300 ]     │              │
│   │  ┌────────────────────────────────────────────────┐ │              │
│   │  │ Required: 300 USD (Bronze 2×)      ✓ cukup      │ │ ←/collateral-│
│   │  └────────────────────────────────────────────────┘ │   quote (4.5)│
│   │  [   Submit borrow intent   ]                        │              │
│   └───────────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tasks

- [ ] **Connect / pilih party** (persona) via `PartyContext` — pastikan `party` ke-set sebelum aksi. Tanpa party, mutation kirim `Bearer ""` → 401.
- [ ] **LendPanel** (`usePlaceBid`) — input `amount` + `rate` (0.03 dst), submit → `POST /bids`. Rate dikirim sebagai desimal (0.05 = 5%), bukan persen.
- [ ] **BorrowPanel** (`useBorrow`) — input `amount` + `maxRate` + `collateralAmount`. Collateral wajib ≥ `amount × multiplier(tier)`; Bronze = 2×. **Tambahan bagus:** tampilkan required collateral live via `/collateral-quote` (lihat 4.5).
- [ ] **StatusPanel** (`useStatus`) — `openBids`, `activeLoans`, `proposals`, `lastMatchAt`. Auto-refetch tiap ~10-15s (auto-matcher backend jalan tiap 20s).
- [ ] **SealedHint** — copy yang jelas: "rate kamu ter-seal, lender lain tak lihat" (ini core value prop, jangan sampai hilang di UI).

### Manual test 4.2

- [ ] Party = LenderA → place bid `amount 100, rate 0.04` → toast success, `GET /bids` (Bearer LenderA) memuat bid itu.
- [ ] `GET /bids` sebagai **Borrower** → `[]` (borrower tak lihat bid — privasi benar, jangan dianggap bug).
- [ ] Party = Borrower → borrow `amount 150, maxRate 0.06, collateral 300` → success.
- [ ] Borrow `collateral 100` (kurang) → **400** "insufficient collateral", UI tampilkan error, bukan freeze.
- [ ] Status panel angka naik setelah submit.

### DoD 4.2

- [ ] Place bid + borrow sukses lawan BE live (persona path).
- [ ] Validasi under-collateral tampil sebagai error, bukan crash.
- [ ] `/bids` scoping benar (lender lihat sendiri, borrower kosong).

---

## 5. Phase 4.3 — Match → Accept/Reject → Repay

**Tujuan:** lifecycle penuh loan. Hook sudah ada (`useProposals`, `useAccept`, `useReject`, `useRepay`, `useRunMatch`). Auto-matcher backend jalan tiap 20s, tapi ada tombol dev `run-match` (Operator) untuk demo deterministik.

### Target UI (wireframe)

```
┌─ Your proposals (party = Borrower) ────────────────────────────┐
│ ● PENDING   principal 150   blended 3.67%   Bronze            │
│   ticks:  LenderA 100 @3.0%    LenderB 50 @5.0%               │
│   [  Accept  ]     [  Reject  (−5% collateral penalty)  ]     │
└────────────────────────────────────────────────────────────────┘
        │ accept
        ▼
┌─ Your loans (party = Borrower) ────────────────────────────────┐
│ ● ACTIVE   principal 150   maturity 2026-08-02               │
│   [  Repay  ]     [  Claim excess  ]                          │
│ ● REPAID   …   → tier Bronze → Silver ✓                       │
└────────────────────────────────────────────────────────────────┘

flow:  bid + bid + borrow ─▶ run-match ─▶ PENDING proposal
       ─▶ accept ─▶ ACTIVE loan ─▶ repay ─▶ REPAID + tier↑
       (reject ─▶ collateral 95% balik, 5% ke operator)
```

### Tasks

- [ ] **Trigger match** — auto (tunggu ≤20s) atau tombol `useRunMatch` (butuh party Operator). Untuk demo, tombol lebih enak (langsung).
- [ ] **Proposals list** (`useProposals`, party=Borrower) — tampilkan proposal PENDING: `principal`, `blendedRate`, `ticks` (tiap lender + rate diskriminatif), `tier`.
- [ ] **Accept** (`useAccept`) — `POST /proposals/:id/accept` → Loan. Setelah accept, invalidate `loans`+`status`.
- [ ] **Reject** (`useReject`) — `POST /proposals/:id/reject`. Backend: 5% collateral di-slash ke operator, 95% balik ke borrower (jelaskan di UI: "reject kena penalti 5%").
- [ ] **Repay** (`useRepay`) — `POST /loans/:id/repay`. Backend urus posisi lender + credit tier bump otomatis.
- [ ] **Loans list** (`useLoans`, party=Borrower) — status ACTIVE/REPAID/LIQUIDATED. **Catatan:** ini view **borrower**. Untuk **lender**, loan aktif ada di `/lender-status` (4.5), bukan `/loans` (lender tak lagi observe Loan).

### Manual test 4.3

- [ ] LenderA bid + LenderB bid + Borrower borrow → run-match (Operator) → proposal muncul di `useProposals` (Borrower).
- [ ] Accept → toast "loan created", loan muncul di `useLoans` (Borrower) status ACTIVE.
- [ ] Repay → status REPAID; credit tier borrower naik (Bronze→Silver) — cek via profil.
- [ ] Buat proposal lain → Reject → proposal hilang, collateral 95% balik (cek holdings borrower).

### DoD 4.3

- [ ] Full lifecycle 1× lawan BE live: bid → borrow → match → accept → repay.
- [ ] Reject flow tested (penalti terlihat).
- [ ] Loan list borrower akurat; lender diarahkan ke lender-status (4.5), tidak menampilkan `[]` membingungkan.

---

## 6. Phase 4.4 — Lens hero + Audit (verify/badges)

**Tujuan:** ini **hero/pitch**. Lens = demo privasi (siapa lihat apa). Audit = diferensiator (auditor re-run match → GREEN/RED). Komponen `LensPanel` sudah ada — sesuaikan ke schema baru (4.1).

### Target UI (wireframe) — ini momen menang demo

```
┌─ The Lens — "siapa lihat apa"  (privasi native Canton, bukan enkripsi) ──┐
│  Proposal P-borrow…  ·  principal 150  ·  blended 3.67%                   │
│                                                                          │
│ ┌ OPERATOR ─────┐ ┌ LENDER A ─────┐ ┌ BORROWER ─────┐ ┌ AUDITOR ──────┐ │
│ │ sees ALL bids │ │ sees OWN bid  │ │ sees proposal │ │ all bids +    │ │
│ │  A 100 @3.0%  │ │  A 100 @3.0%  │ │  blended 3.67%│ │  verdict      │ │
│ │  B 100 @5.0%  │ │  ▓▓ B hidden ▓│ │  ticks A + B  │ │  🟢 GREEN     │ │
│ │  + proposal   │ │               │ │               │ │               │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ │
│ ┌ OUTSIDER (no login) ─────────────────────────────────────────────────┐│
│ │ hanya agregat: openBids 3 · activeLoans 4 · ⛔ NO rate · ⛔ NO identity ││
│ └───────────────────────────────────────────────────────────────────────┘│
│  →  operator lihat SEMUA rate  ·  lender cuma 1  ·  outsider NOL          │
└────────────────────────────────────────────────────────────────────────────┘

┌─ Auditor — re-run match (the differentiator) ──────────────┐
│  Proposal P-…            [ Verify ]                         │
│  Badges:                                                    │
│   🟢 GREEN  P-borrow…   "recomputed == published"          │
│   🔴 RED    P-CHEAT     "a cheaper lend was skipped"        │
│  [ Cheat-match (demo) ]  → proposal curang → Verify → RED   │
└─────────────────────────────────────────────────────────────┘
```

> Panggil `useLens` sebagai **Operator** supaya kelima panel terisi (aman: anonim tetap outsider-only). Tunjuk kontras "operator semua rate / lender satu / outsider nol" — **itu pitch privasi-nya.**

### Tasks

- [ ] **Lens hero** (`useLens`, panggil sebagai **Operator**) — tampilkan 5 perspektif berdampingan untuk 1 proposal:
  - `operator`: SEMUA bid + rate (dia matcher).
  - `lender`: hanya bid **sendiri** (contoh 1 lender) — "rival tak kelihatan".
  - `borrower`: proposal-nya (blended rate + ticks).
  - `auditor`: semua bid + verdict badge.
  - `outsider`: cuma `status` agregat (tanpa rate/identitas).
  - **Framing UI:** highlight kontras "operator lihat semua rate" vs "lender lihat 1 rate" vs "outsider lihat 0 rate". Ini inti privasi native Canton (bukan enkripsi).
- [ ] **Guard perspektif** — karena schema partial, render defensif: `perspectives.lender?.bids ?? []`. (Kalau lens dipanggil sebagai Operator, kelima selalu ada.)
- [ ] **Audit verify** (`useVerify`, party=Auditor) — `POST /audit/verify/:proposalId` → badge GREEN/RED. GREEN = match jujur (cheapest-first dihormati). Untuk demo RED: tombol `useCheatMatch` (Operator) bikin proposal curang → verify → RED.
- [ ] **Badges** (`api.badges`, party=Auditor) — list verdict. Tampilkan proposalId + verdict + reason + waktu.

### Manual test 4.4

- [ ] Ada ≥1 proposal (dari 4.3). Buka Lens.
- [ ] Panel operator tampil semua bid+rate; panel lender cuma 1 rate; panel outsider tanpa rate. **Screenshot ini buat pitch.**
- [ ] Verify (Auditor) proposal jujur → **GREEN**.
- [ ] Cheat-match (Operator) → proposal baru → Verify → **RED** dengan reason.
- [ ] `curl ".../api/lens"` tanpa auth → outsider-only (buktikan ke juri: "tanpa login, orang luar cuma lihat agregat").

### DoD 4.4

- [ ] Lens 5-perspektif render benar (Operator view).
- [ ] GREEN + RED path keduanya kebukti live.
- [ ] Anonim lens = outsider-only (privacy proof, bisa ditunjuk saat demo).

---

## 7. Phase 4.5 — Dashboard lender + collateral-quote + wallet path

**Tujuan:** lengkapi view lender (yang berubah karena privasi) + polish input borrow + (opsional) real wallet.

### Target UI (wireframe)

```
┌─ Profile: LenderA ─────────────────────────────────────────┐
│ Tier Bronze (2×)  ·  repaid 0  ·  defaulted 0              │ ← /credit-score
│                                                            │
│ Active positions  (from /lender-status — PRIVATE):         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ borrower Borrower  ·  my rate 3.0%  ·  owed 103.0     │ │
│  │ maturity 2026-08-02                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⚠ LenderB's 5.0% rate is NOT shown here (privacy proof)  │
└────────────────────────────────────────────────────────────┘

LenderA screen: my rate 3.0% only    LenderB screen: my rate 5.0% only
                (tak lihat 5.0%)                     (tak lihat 3.0%)
```

### Tasks

- [ ] **Dashboard lender** (`api.lenderStatus`, Bearer=self) — untuk party lender, tampilkan `activeLoans[]` = posisi privat: `{ borrower, myPrincipal, myRate, owedToMe, maturity }`. **Ini pengganti `/loans` untuk lender** (lender tak lagi observe Loan). Wire di `Profile` (komponen `ActivePositions` / `PositionsList`).
  - Bukti privasi: LenderA lihat `myRate 0.03`, LenderB lihat `myRate 0.05` — **tak saling lihat**. Bisa jadi bullet pitch.
- [ ] **Collateral quote** di BorrowPanel — `GET /collateral-quote?party=<self>&amount=<x>&instrument=USD` (Bearer=self) → tampilkan `requiredCollateral` live saat user ketik amount. Enak buat UX ("kamu butuh 300 USD collateral untuk pinjam 150").
- [ ] **Credit score** di Profile — `GET /credit-score/<self>` (Bearer=self) → `{ tier, loansRepaid, loansDefaulted, collateralMultiplier }`. Ganti `useProfile` yang saat ini nebak tier dari `borrows[0].tier`.
- [ ] **(P3) Wallet path** — kalau real Canton wallet connect (`partyId` ada), hook pakai `*AsWallet` (`src/lib/wallet/commands.ts`). **PENTING:** SC berubah (Repay butuh `positionCids`, dst.). Jalur wallet `repayAsWallet`/`walletRepayInfo` **mungkin perlu update** ikut signature choice baru. **Koordinasi dengan Alven sebelum garap wallet path** — demo utama pakai persona (jalan tanpa perubahan).

### Manual test 4.5

- [ ] Party LenderA (punya loan aktif dari 4.3) → `/lender-status/LenderA` → activeLoans berisi posisi dengan `myRate` benar.
- [ ] LenderA vs LenderB → masing-masing cuma lihat rate sendiri.
- [ ] BorrowPanel: ketik amount 150 → collateral quote tampil 300 (Bronze 2×).
- [ ] Credit score borrower setelah 1 repay → tier Silver.

### DoD 4.5

- [ ] Lender dashboard tampil posisi privat (via lender-status), bukan `[]`.
- [ ] Collateral quote live di borrow form.
- [ ] Wallet path: kalau digarap, koordinasi + tested; kalau tidak, persona path solid dan wallet di-hide.

---

## 8. Phase 4.6 — Polish + demo prep

- [ ] **Loading states konsisten** — bid/borrow/accept/repay tampil spinner (submit ke ledger 1–3s).
- [ ] **Error toasts** — `FeedbackContext` sudah ada; pastikan tiap mutation `onError` show pesan. 409/502 kasih tombol retry.
- [ ] **Mobile responsive** — semua panel (Home tabs, Lens 5-kolom → stack di mobile, Profile).
- [ ] **Copy privasi** — pastikan tagline "sealed-bid, native Canton privacy (bukan enkripsi/TEE)" muncul di hero/FAQ.
- [ ] **Demo script full** (top-to-bottom, rekam video 2 menit):
  1. Connect sebagai LenderA → place sealed bid 0.03.
  2. LenderB → bid 0.05. Borrower → borrow 150.
  3. Run-match (Operator) → proposal.
  4. **Lens**: tunjuk operator lihat semua rate, lender cuma sendiri, outsider nol → *ini momen pitch privasi*.
  5. Auditor verify → GREEN. Cheat-match → verify → RED → *ini momen pitch auditability*.
  6. Borrower accept → repay → tier naik.
  7. LenderA lihat `/lender-status` → posisi + owedToMe (rate LenderB tak kelihatan).
- [ ] **Slide pitch**: Problem (settlement butuh privasi + auditability) → Solusi (sealed-bid P2P di Canton, privacy = projection native, auditor re-run match) → Demo (video) → Tech (Canton + Daml, no TEE, no enkripsi) → Security (audit internal: semua CRITICAL/HIGH ditutup) → Roadmap.

---

## 9. Common pitfalls (FAQ)

### "Lens error / halaman blank setelah pull"
Backend Lens sekarang butuh Bearer. `api.lens` lama kirim tanpa auth → dapat outsider-only → schema gagal. **Fix di Phase 4.1**: kirim `party: "Operator"` + relax `lensViewSchema` jadi optional. Ini #1 penyebab error setelah pull.

### "Profil lender kosong padahal ada loan"
Lender **tak lagi observe Loan** (fix privasi per-lender). `GET /loans` untuk lender = `[]` **by design**. Loan lender ada di `GET /lender-status/:party` (Phase 4.5). Jangan pakai `/loans` untuk view lender.

### "401 Unauthorized di dashboard"
`/lender-status`, `/borrower-status`, `/credit-score`, `/collateral-quote` di-gate: butuh `Bearer == party yang diminta` (atau Operator/Auditor). Kirim Bearer party yang sedang connect, dan pastikan `:party` di URL == party itu.

### "403 Forbidden padahal sudah connect"
Kamu minta data party LAIN. Contoh connect sebagai LenderA tapi fetch `/lender-status/LenderB` → 403. Hanya boleh data sendiri (kecuali Operator/Auditor).

### "zod parse error di /market"
Volume bisa `null` (k-anonymity saat <2 peserta). Bikin field `.nullable()`. Render `null` sebagai "—" atau "hidden (privacy)".

### "rate ke-submit sebagai 5 bukan 0.05"
Backend pakai desimal: `0.05` = 5%. Convert di boundary form (kalau input user persen, bagi 100).

### "UI freeze pas backend error"
`call()` throw `ApiError` untuk semua non-2xx. Pastikan mutation `onError` handle (hook existing sudah). Untuk query, pakai `QueryState` (sudah ada) untuk render error state.

### "Match nggak jalan / proposal nggak muncul"
Auto-matcher jalan tiap 20s — tunggu, atau klik run-match (Operator). Kalau run-match **400 CONTRACT_NOT_FOUND** berulang → kabari Alven (dulu ada bug matcher-brick, sudah difix; kalau muncul lagi berarti state ledger perlu reseed).

### "Wallet path (real Canton) error di repay/accept"
SC berubah (Repay butuh `positionCids`, dst.). Jalur `*AsWallet` mungkin belum ikut. **Demo pakai persona** (jalan). Wallet path = P3, koordinasi Alven dulu.

### "Angka bid/borrow di UI aneh setelah accept"
Di canton mode, `bidDto.status` selalu `"OPEN"` (backend belum track transisi per-bid di DTO). Jangan andalkan `bid.status === "MATCHED"` untuk "active lends"; pakai `/lender-status` (Phase 4.5).

---

## 10. Definition of Done per halaman

### Home (`/`)
- [ ] Place bid + borrow sukses live (persona path)
- [ ] Under-collateral → error tampil, bukan crash
- [ ] Status panel auto-refresh, angka akurat
- [ ] Tagline sealed-bid/privacy jelas
- [ ] Mobile responsive

### Lens (hero)
- [ ] 5 perspektif render (via Operator Bearer)
- [ ] Kontras operator/lender/outsider jelas secara visual
- [ ] Anonim lens = outsider-only (bisa ditunjuk ke juri)
- [ ] Guard perspektif partial (tak crash kalau field hilang)

### Audit
- [ ] Verify GREEN (match jujur) kebukti
- [ ] Cheat-match → RED kebukti
- [ ] Badge list tampil (verdict + reason)

### Lifecycle (proposals/loans)
- [ ] Accept → loan ACTIVE
- [ ] Repay → REPAID + tier naik
- [ ] Reject → collateral 95% balik (penalti 5% terlihat)

### Profile / Dashboard lender
- [ ] Lender: posisi via `/lender-status` (myRate, owedToMe)
- [ ] Rate rival TIDAK terlihat (privasi kebukti)
- [ ] Credit score/tier dari `/credit-score`
- [ ] Mobile responsive

---

## 11. Estimasi waktu

Asumsi Bima 1 orang, sudah familiar Next.js (versi repo) + TanStack Query + zod. FE sudah ada, ini sync + verify + lengkapi.

| Phase | Estimasi |
|-------|----------|
| 4.1 Sync kontrak API (schema + lens + lender-status schema) | 0.5 hari |
| 4.2 Home verify (lend/borrow/status) | 0.5 hari |
| 4.3 Lifecycle (match/accept/reject/repay) | 1 hari |
| 4.4 Lens hero + Audit | 1 hari |
| 4.5 Dashboard lender + collateral-quote (+ wallet path opsional) | 1 hari |
| 4.6 Polish + demo prep | 1 hari |
| **Total** | **~5 hari** (tanpa wallet path; +1–2 hari kalau garap real wallet) |

Kalau molor (bug/RPC/ledger issue), kabari Alven **sehari** — bisa adjust scope (mis. wallet path dan swap di-drop kalau time pressure; keduanya bukan core demo).

---

## 12. Kontak

- **Backend / API / kontrak** → Alven (chat / WhatsApp)
- **Canton wallet / dApp-SDK deeper** → lihat `docs/RUNBOOK_REAL_WALLET_DEVNET.md` dulu, baru tanya Alven
- **Block/stuck >2 jam** → DM Alven, jangan diem 1 hari ngacak

Ringkas prioritas: **4.1 (sync) → 4.2/4.3 (core flow) → 4.4 (lens+audit hero) → sisanya**. Yang bikin menang demo = **Lens (privasi) + Audit GREEN/RED**. Fokus ke sana.

Selamat ngoding 🚀
