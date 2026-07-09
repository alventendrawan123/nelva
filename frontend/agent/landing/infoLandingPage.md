# Nelva — Landing Page Content Brief

> Untuk Bima. Semua fakta di bawah sudah diverifikasi dari smart contract + backend (bukan
> marketing kosong). Copy suggestion ditulis in English (biar match app). Catatan/guidance
> ditulis Bahasa Indonesia. **Section "Credit Tier Flow" WAJIB ada** (request Alven).

---

## 0. One-liner / positioning

**Nelva — private, provably-fair P2P lending on Canton.**

Sealed-bid lending di mana rate kamu privat, dan match-nya bisa dibuktikan jujur oleh siapa saja.

Tagline options:
- "Your rate stays sealed. The match stays honest."
- "Private bids. Provable matching. No trust required."
- "Sealed-bid lending where honesty is the only winning strategy."

---

## 1. Hero

**Headline:** Borrow & lend privately — with a match anyone can verify.

**Subhead:** Nelva is a sealed-bid P2P lending market on Canton. Your interest rate is never
exposed to rivals, and an independent auditor can re-run the match on-ledger to prove it was fair.

**Primary CTA:** Launch app → https://nelva-ashy.vercel.app
**Secondary CTA:** How it works ↓

---

## 2. The problem (kenapa Nelva ada)

Di lending market biasa:
- **Rate kamu kelihatan** → order book publik = di-front-run, rate dimanipulasi rival.
- **Matcher-nya black box** → operator bisa curang: isi lender mahal duluan, skim selisih bunga.
- **Kamu harus percaya operator** → gak ada cara buktiin match-nya jujur.

Copy: *"On a public order book, showing your rate is showing your hand. And when a centralized
engine matches trades behind closed doors, you just have to trust it didn't skim the spread."*

---

## 3. Differentiators (INTI — ini yang bikin Nelva beda)

### 3.1 Sealed bids — privacy by Canton, not encryption
Rate kamu cuma kelihatan sama matching engine, gak pernah ke rival lender/borrower. Ini pakai
**Canton sub-transaction privacy** (bawaan ledger), bukan enkripsi yang bisa dibuka.
> Copy: "Your max rate is sealed — only the matching engine sees it, never rival borrowers.
> Canton privacy, not encryption."

### 3.2 Deterministic matching — cheapest-first, on-ledger
Match jalan on-ledger pakai algoritma deterministik (lender termurah dimatch duluan). Hasilnya
selalu sama untuk input yang sama. **Bidding jujur = strategi terbaik** (gak ada gunanya main rate).

### 3.3 Independent auditor — GREEN / RED verdict (differentiator utama)
Auditor adalah **proses terpisah** (bukan server operator). Dia baca bid + borrow yang committed,
**re-run match yang sama byte-for-byte on-ledger**, lalu keluarin badge:
- **GREEN** = published match == honest recompute (jujur).
- **RED** = operator memalsukan match.
> Kunci: karena match-nya deterministik & di-*re-execute*, operator gak bisa boong. Ini mustahil
> di matcher black-box (mis. TEE) yang gak pernah dijalankan ulang.

### 3.4 Prevent-by-construction — cheat gak bisa settle
Bukan cuma *deteksi*. Saat borrower **Accept**, ledger **re-validasi match**-nya. Kalau proposal
menyimpang dari hasil jujur → ledger **tolak** (gak bisa jadi Loan). Jadi curang bukan cuma
ketahuan, tapi **gak akan pernah settle**.

> Susun sebagai 4 kartu / 4 icon. Ini jual utama Nelva.

---

## 4. How it works (flow utama)

Buat jadi diagram 5 langkah:

1. **Lend** — Lender submit *sealed bid* (amount + rate). Rate disegel.
2. **Borrow** — Borrower submit *borrow intent* (amount + max rate + collateral).
3. **Match** — Operator jalanin deterministic match → *match proposal* (blended rate).
4. **Accept** — Borrower Accept → **atomic settlement** → **Loan** dibuat (dana ke borrower,
   collateral terkunci). Accept re-validasi match (lihat 3.4).
5. **Repay** — Borrower bayar principal + bunga → collateral balik + **naik credit tier**.

Catatan akurat: settlement itu **atomic** (dana + collateral pindah dalam 1 transaksi, gak ada
state setengah jadi). Blended rate = rata-rata tertimbang dari beberapa lender yang ngisi 1 borrow.

---

## 5. ⭐ CREDIT TIER FLOW (WAJIB — request Alven)

**Konsep:** Tiap borrower mulai dari **Bronze**. Tiap kali **Repay sukses**, naik 1 tingkat.
Makin tinggi tier = makin dipercaya = **collateral yang dibutuhin makin sedikit**. Ini reputasi
on-chain kamu.

### Tabel tier (angka pasti dari smart contract)

| Tier | Collateral multiplier | Collateral utk pinjam 100 nUSD | Cara dapat |
|------|----------------------|-------------------------------|-----------|
| 🥉 **Bronze**   | 2.0× | 200 | Tier awal semua borrower |
| 🥈 **Silver**   | 1.8× | 180 | Repay 1× |
| 🥇 **Gold**     | 1.5× | 150 | Repay 2× |
| 💎 **Platinum** | 1.2× | 120 | Repay 3× (tertinggi) |

### Visual yang diminta — progression ladder

```
🥉 Bronze ──repay──▶ 🥈 Silver ──repay──▶ 🥇 Gold ──repay──▶ 💎 Platinum
   2.0×                1.8×                1.5×               1.2×
   (200)               (180)               (150)              (120)
        collateral makin turun  ─────────────────────────▶
```

Poin penting buat copy:
- **Naik tier:** tiap Repay sukses → naik 1 tingkat (`BumpUp`).
- **Turun tier:** kalau loan gagal / dilikuidasi → turun 1 tingkat (`BumpDown`).
- **Platinum = puncak.** Repay lagi setelah Platinum → tetap Platinum (multiplier tetap 1.2×,
  cuma rekam jejak `loansRepaid` yang nambah).
- Benefit tier = **collateral lebih murah**, jadi modal kamu lebih efisien makin lama makin dipercaya.

> Copy: "Build your on-chain reputation. Every loan you repay ranks you up — and every rank means
> less collateral locked. Start at Bronze (2x collateral), reach Platinum (just 1.2x)."

---

## 6. Collateral & safety

- **Over-collateralized** — borrower kunci collateral di atas nilai pinjaman (sesuai tier).
- **Claim Excess** — kalau kamu setor collateral lebih dari minimum tier, kelebihannya bisa
  ditarik kapan aja di tengah loan (tanpa lunasin dulu).
- **Repay** — lunasin principal + bunga → semua collateral balik + naik tier.
- **Liquidation (proteksi lender)** — kalau nilai collateral turun di bawah ambang sehat, loan
  bisa dilikuidasi: 95% pro-rata ke lender, 5% fee operator, borrower turun tier.
- **Health floor 1.1** — ambang likuidasi/claim di-set di bawah multiplier tier terendah
  (Platinum 1.2×), jadi tiap tier aman di collateral minimumnya.

---

## 7. Real wallet — non-custodial

- Connect **real Canton wallet** (CIP-0103 external signing) — kamu tanda tangan pakai **key
  sendiri**, Nelva **gak pernah pegang dana kamu**.
- Ada juga **embedded demo wallet** buat coba cepat tanpa setup.
> Copy: "Non-custodial by design. Sign with your own key via a real Canton wallet — Nelva never
> holds your funds."

---

## 8. Built on Canton

- **Privacy-native ledger** — sub-transaction privacy bawaan, bukan tambahan.
- **Atomic settlement** — swap dana <-> collateral dalam 1 transaksi, no bridge, no partial state.
- **Deterministic Daml smart contracts** — logika match & lifecycle di-enforce ledger, bisa
  di-audit ulang.

---

## 9. FAQ (dari app, bisa dipakai langsung)

- **What is Nelva?** A sealed-bid P2P lending market on Canton where rates stay private and the
  match is independently verifiable.
- **How are lending rates discovered?** Lenders submit sealed bids; a deterministic engine matches
  the cheapest first and publishes a blended rate — honest bidding is always optimal.
- **Can the operator see my bid?** The matching engine sees your rate to compute the match, but
  rival lenders/borrowers never do, and the operator can't fabricate the result (the auditor
  re-runs it, and Accept re-validates it on-ledger).
- **What is auditable matching?** An independent auditor re-executes the same deterministic match
  on-ledger and flips a GREEN/RED badge — proving the published match wasn't rigged.
- **How do credit tiers & collateral work?** Every repaid loan ranks you up (Bronze -> Platinum),
  and higher tiers require less collateral (2.0x down to 1.2x).

---

## 10. CTA penutup

**Try Nelva now** — https://nelva-ashy.vercel.app
Sub: "Connect a wallet, place a sealed bid, and watch the match verify itself."

---

## 11. Catatan desain buat Bima

- **Tier flow = hero section kedua** (habis "how it works"). Bikin ladder/progress bar visual
  Bronze->Platinum yang jelas nunjukin collateral turun. Ini yang Alven minta.
- 4 differentiator (sec 3) -> 4 kartu sejajar, tiap kartu 1 icon + 1 kalimat.
- Warna tier: Bronze (coklat ~#CD7F32), Silver (abu perak), Gold (emas), Platinum (putih-biru
  platinum). Bisa jadi accent visual yang kuat.
- Jangan over-claim: privacy itu **Canton sub-transaction privacy, bukan enkripsi**. Auditor
  **mendeteksi + Accept mencegah** — dua-duanya sebut, jangan cuma "unhackable".
- Angka collateral (200/180/150/120 utk pinjam 100) itu real — aman dipajang.
