# Nelva — User Flow & Wireframe

> Alur tiap persona + wireframe ASCII tiap layar. Buat Bima (FE). Wireframe = sketsa layout, bukan desain final — bebas dipercantik (Tailwind+shadcn), tapi pertahankan struktur & momen MERAH.

---

## A. User flow (per persona)

### A1. Lender
```
Login(pilih "Lender") → Dashboard → "Place Bid"
  → isi {amount, rate rahasia, durasi} → Submit
  → sistem: mint cash (mock) → Lock ke operator → create SealedBid
  → status "OPEN" → (operator run match) → "MATCHED" → lihat Loan & jadwal bayar
Anti-grief: kalau tak ke-match sampai deadline → tombol "Withdraw" (dana balik).
```

### A2. Borrower
```
Login("Borrower") → Dashboard → "Request Loan"
  → isi {amount, maxRate, collateral} → Submit (collateral di-lock)
  → lihat tier (Bronze..Platinum) + requiredCollateral
  → (operator run match) → muncul "Match Proposal" {principal, blendedRate, ticks}
  → [Accept] (ATOMIK: dana masuk, loan jadi)  atau  [Reject] (slash 5%)
  → Loan aktif → [Repay] → naik tier
```

### A3. Operator (panel admin/demo)
```
Login("Operator") → Admin → [Run Match] → proposals terbentuk
  → [Set Price] (oracle) → [Liquidate] loan tak sehat
  → [Cheat Match] (DEMO) → bikin match curang untuk picu badge MERAH
```

### A4. Auditor (diferensiator)
```
Login("Auditor") → lihat SEMUA bid (termasuk yang KALAH)
  → pilih MatchProposal → [Verify]
  → sistem re-run match deterministik → bandingkan
  → HIJAU (cocok)  atau  MERAH (operator skip lend murah / ubah tick)
```

### A5. Lens (fitur hero — dipakai saat demo)
```
Buka "Lens" → pilih sebuah MatchProposal
  → tampil 5 kolom sudut pandang (Lender/Borrower/Operator/Auditor/Orang-luar)
  → tiap kolom menampilkan APA YANG PARTY ITU BOLEH LIHAT (beda-beda)
  → klik [Compare] → diff side-by-side (hijau=sama, kuning=1 saja, abu=disembunyikan)
  → klik [Cheat & Re-Audit] → badge berubah MERAH  ◄── MONEY SHOT
```

---

## B. Wireframe (ASCII)

### B0. Top bar + party switcher (semua halaman)
```
┌───────────────────────────────────────────────────────────────────┐
│ 🛡 NELVA   [Lender][Borrower][Operator][Auditor][Outsider]   ● USD │
└───────────────────────────────────────────────────────────────────┘
   ▲ party switcher = ganti sudut pandang (dev). Aktif = highlight.
```

### B1. Lender dashboard + place bid
```
┌─ Lender ──────────────────────────────────────────────────────────┐
│  Saldo: 100 USD            ┌─ Place Sealed Bid ──────────────────┐ │
│                            │ Amount   [ 100      ] USD           │ │
│  My Bids                   │ Rate     [ 5.0      ] %  🔒 rahasia │ │
│  ┌─────────────────────┐   │ Duration [ 30       ] hari          │ │
│  │ 100 USD · 🔒 · OPEN │   │            [ Submit Bid ]           │ │
│  │ 50  USD · MATCHED   │   └─────────────────────────────────────┘ │
│  └─────────────────────┘   ℹ Rate kamu TIDAK terlihat lender lain.  │
└───────────────────────────────────────────────────────────────────┘
```

### B2. Borrower — request + match proposal
```
┌─ Borrower ────────────────────────────────────────────────────────┐
│ Request Loan                         Tier: Bronze (kolateral 2.0x)  │
│  Amount [150] USD  MaxRate [6.0]%  Collateral [300] USD  [Request]  │
│                                                                     │
│ ── Match Proposal ───────────────────────────────────────────────  │
│  Principal 150 USD   Blended 3.67%                                  │
│  Ticks:  Lender A  100 @ 3.0%   ← tiap lender bunga sendiri         │
│          Lender B   50 @ 5.0%     (discriminatory)                  │
│                         [ ✓ Accept ]   [ ✗ Reject (−5%) ]          │
└───────────────────────────────────────────────────────────────────┘
```

### B3. Loans + repay
```
┌─ Loans ───────────────────────────────────────────────────────────┐
│ #L1  150 USD  blended 3.67%  collateral 300  health 2.0x  ACTIVE    │
│      jatuh tempo 30 hari        [ Repay ]                           │
│ #L0  100 USD  ...                              REPAID  ✓ +tier      │
└───────────────────────────────────────────────────────────────────┘
```

### B4. Auditor console (diferensiator)
```
┌─ Auditor ─────────────────────────────────────────────────────────┐
│ Semua bid (termasuk KALAH):  A 100@3%  B 50@5%  C 80@4%(loser)      │
│                                                                     │
│ MatchProposal #P1   →   [ Verify ]                                  │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │  expected ticks  ==  published ticks ?                         │ │
│ │  ✅  GREEN — match jujur, urutan termurah dihormati            │ │
│ └───────────────────────────────────────────────────────────────┘ │
│  (kalau operator skip C@4% padahal lebih murah → ❌ RED + reason)  │
└───────────────────────────────────────────────────────────────────┘
```

### B5. LENS — side-by-side diff (HERO)  ◄── prioritas estetika
```
┌─ Lens · MatchProposal #P1 ───────────────────────────  [Compare ▮] ┐
│ LENDER A   │ BORROWER   │ OPERATOR    │ AUDITOR     │ OUTSIDER      │
│────────────┼────────────┼─────────────┼─────────────┼───────────────│
│ My bid     │ My loan    │ ALL bids:   │ ALL bids    │ Status:       │
│  100 @3%🟢 │  150 USD🟢 │  A 100@3% 🟡│  +loser C 🟡│  3 loans      │
│ (B? ⬜)    │ blended    │  B 50 @5% 🟡│  verdict:   │ (no bids ⬜)  │
│ (C? ⬜)    │  3.67% 🟢  │  C 80 @4% 🟡│  ✅ GREEN   │ (no rates ⬜) │
│────────────┴────────────┴─────────────┴─────────────┴───────────────│
│ 🟢 sama-sama lihat   🟡 cuma pihak ini   ⬜ disembunyikan            │
│                                   [ ⚠ Cheat & Re-Audit ] ◄ MONEY SHOT│
└───────────────────────────────────────────────────────────────────┘
   klik Cheat&Re-Audit →  kolom AUDITOR: ✅GREEN  ➜  ❌ RED  (animasi)
```

### B6. Status publik (outsider / juri)
```
┌─ Public Status ───────────────────────────────────────────────────┐
│ Open bids: 3   Active loans: 2   Last match: 12s ago               │
│ (tidak ada satu pun bunga / posisi / identitas yang terlihat)      │
└───────────────────────────────────────────────────────────────────┘
```

---

## C. Alur demo (3 menit, untuk Jeje + Bima)
```
1. (15s) Buka Lens → "ledger sama, tiap pihak lihat beda" → tunjuk ⬜ outsider kosong.
2. (30s) Lender A & B pasang bid rahasia → tunjuk rival tak saling lihat.
3. (30s) Operator Run Match → proposal muncul (discriminatory: A 3%, B 5%).
4. (30s) Borrower Accept → 1 transaksi → dana pindah, loan jadi (atomik, no custody).
5. (45s) KLIMAKS: Operator [Cheat Match] (skip lend murah) → Auditor [Verify]
         → badge ❌ MERAH. "Privat TAPI tetap ketahuan kalau curang."
6. (30s) Penutup: 1 kalimat jualan + Track 1.
```

---

## D. Catatan implementasi FE (Bima)
- React 18 + Vite + TS + Tailwind + shadcn. State: data dari BE via `fetch`/openapi-fetch. **Tidak menyentuh blockchain.**
- Privasi **bukan** difilter di FE — BE sudah kirim data per-party (lihat `2_TECH_SPEC §6`). FE render apa adanya.
- Prioritas estetika: **Lens diff (B5)** + **animasi badge MERAH** = yang dilihat juri.
- Angka uang = string desimal (jangan parse ke float untuk hitung; tampilkan apa adanya).
- Mulai dengan **mock API** (fixtures sesuai bentuk di `2_TECH_SPEC §5.6`) supaya FE tak nunggu BE Alven.
```
Urutan build FE: Login/switcher → Lender bid → Borrower accept → Auditor verify → LENS (hero) → polish.
```
