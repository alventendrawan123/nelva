# 🎤 Nelva — Pitch Script (Canva deck + speaker script)

> **Untuk:** Encode "Build on Canton" — mid-checkpoint pitch (~3 menit). Bisa dipakai ulang buat video final.
> **Bahasa:** baris yang DIUCAPKAN + teks slide = **English** (juri internasional). `(ID:)` = arahan buat tim.
> **Aturan Canva:** teks slide SEDIKIT (1 ide/slide, font gede), detail ada di "SPEAKER". Aksen warna: indigo + **MERAH/HIJAU** buat badge.
> **Track:** 1 — Private DeFi & Capital Markets.

---

## SLIDE 1 — Title · ~10s
**On-slide:**
- **NELVA**
- *Private lending on Canton where the match is provably honest — without revealing anyone's bid.*
- Track 1 · Private DeFi · Team Nelva

**SPEAKER:**
> "Hi, we're team Nelva. We're building private peer-to-peer lending on Canton — where lenders' interest rates stay secret, yet anyone can prove the matching was fair."

*(ID: buka tenang, percaya diri. Logo + 1 kalimat doang di layar.)*

---

## SLIDE 2 — The Problem · ~25s
**On-slide:**
- In DeFi lending, **everything is public**: rates, positions, collateral.
- → front-running (MEV) · no real price discovery · targeted liquidation
- **Institutions can't use a market where everyone sees their book.**

**SPEAKER:**
> "In normal DeFi lending, everything is public — your rate, your positions, your collateral. Bots front-run you, everyone earns the same blended pool rate so there's no honest price discovery, and your positions are exposed to targeted attacks. For a real institution, a market where everyone can see your book is a non-starter."

*(ID: tekankan "everything public" — visual mata / blok transparan.)*

---

## SLIDE 3 — The gap everyone misses · ~20s
**On-slide:**
- You can hide the bids… **but then how do you trust the matcher?**
- A private matcher can cheat **invisibly**.
- **Privacy alone isn't enough. You need private AND auditable.**

**SPEAKER:**
> "You could hide the bids — some projects do, using secret hardware enclaves. But that creates a new problem: if no one can see the bids, how do you trust the matching engine didn't cheat? A private matcher can rig the match invisibly. So privacy alone isn't enough — you need privacy AND auditability."

*(ID: ini "aha" moment. Pelan di kalimat terakhir.)*

---

## SLIDE 4 — Solution: Nelva · ~25s
**On-slide (3 pilar):**
1. 🔒 **Sealed bids** — rates private per-party (native Canton, no crypto)
2. ⚙️ **Deterministic match** — cheapest-first, pay-as-bid, on-ledger
3. ✅ **Auditable** — an auditor re-runs the match → **GREEN / RED**

**SPEAKER:**
> "Nelva solves both. One: lenders submit sealed bids — rivals literally cannot see each other's rate, enforced by Canton's privacy, not encryption. Two: a deterministic engine matches them on-ledger, cheapest first, each lender keeping their own rate. Three — the key part — an independent auditor re-runs the exact same match and flips a badge: green if honest, red if the operator cheated. All without ever exposing a single bid."

*(ID: 3 ikon muncul satu-satu.)*

---

## SLIDE 5 — ⭐ The differentiator (HERO) · ~25s
**On-slide:**
- Operator skips a cheaper lender → Auditor re-runs → **🔴 RED**
- *Private. But if the operator lies — it's caught.*
- **No prior Canton project, and no transparent chain, can do this.**

**SPEAKER:**
> "Here's what makes Nelva different. Say the operator cheats — skips a cheaper lender to favor a friend. The auditor re-executes the identical, deterministic match over the same bids, sees the mismatch, and flips the badge to RED. The market stays private, but dishonesty is provably caught. A black-box enclave can't be re-checked, and a transparent chain has no privacy at all — this 'private AND auditable' matching is genuinely new."

*(ID: ini jualan utama. Tunjuk animasi MERAH di slide/demo.)*

---

## SLIDE 6 — Why Canton · ~15s
**On-slide:**
- Privacy is **native** (per-party sub-transaction visibility)
- **Atomic** multi-party settlement, no operator custody
- Built for **institutional capital markets**

**SPEAKER:**
> "This only works on Canton. Privacy is built into the protocol per party, settlement is atomic across parties with no operator holding your funds, and it's designed for regulated, institutional finance — exactly our use case."

---

## SLIDE 7 — How it works · ~20s
**On-slide (alur sederhana):**
- `Bid (sealed) → Match → Accept (atomic) → Repay / Liquidate`
- `↘ Auditor re-runs → GREEN / RED`
- Smart contracts in **Daml** · thin backend over **JSON Ledger API** · web UI

**SPEAKER:**
> "Under the hood: lenders lock funds and post sealed bids; the operator runs the match; the borrower accepts in a single atomic transaction — funds move with no operator custody; loans repay or liquidate. And at any point the auditor can verify. It's all Daml smart contracts on Canton, a thin backend, and a web front-end."

*(ID: diagram simpel, jangan padat.)*

---

## SLIDE 8 — Demo · ~30s
**On-slide:**
- (Embed klip / screenshot: Lens 5 sudut pandang + badge berubah **🔴 RED**)
- *Same ledger — each party sees only its slice. Outsider sees nothing.*

**SPEAKER:**
> "Quick demo. This is the same ledger seen from five perspectives — a lender sees only their own bid, an outsider sees nothing. The operator runs a match… now watch: the operator cheats, the auditor verifies… and the badge flips RED. Private, but caught."

*(ID: KLIMAKS. Kalau FE belum jadi, pakai screenshot/output BE: GREEN lalu RED. Jeje siapin klip 20–30 detik.)*

---

## SLIDE 9 — Traction (what's built) · ~20s
**On-slide:**
- ✅ Full Daml model — **10/10 tests passing**
- ✅ Running on **real Canton** (JSON Ledger API) — match, settle, audit **end-to-end**
- ✅ Backend gateway live (mock + Canton)
- 🔜 Web UI (Lens) + live DevNet link

**SPEAKER:**
> "Where we are at the checkpoint: the full smart-contract model is done and tested — ten of ten. It already runs on real Canton, end to end: bid, match, accept, repay, liquidate, and the auditor's green/red verdict — not a mock. The backend gateway is live. Next we're finishing the web UI and a public DevNet deployment."

*(ID: bukti eksekusi — kriteria juri "Does it work?". Jujur: UI in progress.)*

---

## SLIDE 10 — Roadmap & Team · ~15s
**On-slide:**
- **Next:** Lens web UI · live on DevNet · polish
- **Team:** Alven (smart contracts + backend) · Bima (frontend) · Jeje (video/design)

**SPEAKER:**
> "From here: the Lens front-end, a live public deployment on DevNet, and polish. Our team — Alven on contracts and backend, Bima on frontend, Jeje on design and video."

---

## SLIDE 11 — Close · ~10s
**On-slide:**
- **NELVA — private lending you can actually trust.**
- *Private. Auditable. On Canton.*
- (repo / live link)

**SPEAKER:**
> "Nelva: a private lending market that institutions can actually trust — because privacy and proof finally coexist. Thank you."

*(ID: balik ke logo + 3 kata: Private. Auditable. On Canton.)*

---

## 🎨 Canva tips (buat Jeje/Bima)
- **1 ide per slide**, teks gede, ≤ ~15 kata. Detail diomongin, bukan ditulis.
- Aksen: **indigo** (brand) + **merah/hijau** khusus badge.
- Slide 5 & 8 = bintang → kasih ruang + animasi badge MERAH.
- Konsisten: 1 font heading + 1 body, spacing lega, ikon seragam.
- Total ~3 menit: jangan kebanyakan slide; latihan baca keras pakai timer.
- Buat **video 3 menit**: slide + voiceover script ini tinggal rekam; sisipin klip demo di slide 8.

## ⚠️ Jujur (jangan overclaim ke juri)
- Bilang **"runs on real Canton"** (sandbox = Canton asli) — bukan "mainnet".
- Operator BISA lihat bid (bukan TEE-buta) → framing benar: **"private from rivals + dishonesty is provably caught"**, bukan "operator can't see".
- UI **in progress** — sampaikan sebagai roadmap; inti udah jalan.
