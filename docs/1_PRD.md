# Nelva — Product Requirement Document (PRD)

> Dokumen produk untuk tim (Alven=SC+BE, Bima=FE, Jeje=video). Bahasa campur ID + istilah teknis EN.
> Status: konsep LOCKED. SC inti sudah dibangun & lulus test (lihat `5_STATUS` di bawah).

---

## 1. Ringkasan (1 paragraf)
**Nelva** = pasar pinjam-meminjam (P2P lending) **privat** di **Canton** di mana lender memasang bunga secara **rahasia (sealed-bid)**, sebuah mesin pencocok (matching) menjodohkan lender↔borrower secara rahasia, **DAN** seorang **Auditor bisa membuktikan pencocokannya jujur tanpa pernah membuka bid siapa pun**. Implementasi **orisinal di Canton**: memanfaatkan privasi native + menambah satu hal yang pendekatan rahasia-via-black-box (enclave/TEE) tak bisa: **matching yang bisa diaudit**.

**Satu kalimat jualan:** *"Menyembunyikan bid di black-box (enclave) bikin matchnya tak bisa diperiksa ulang → kejujuran tak terbukti. Nelva menyembunyikan bid secara native di Canton + auditor mengeksekusi ulang match deterministik atas bid yang KALAH → operator curang ketahuan."*

**Target:** menang **Encode "Build on Canton" — Track 1 (Private DeFi & Capital Markets)**.

---

## 2. Masalah
Di DeFi lending biasa (Aave/Compound), **semuanya publik**: bunga, posisi, kolateral terlihat semua. Akibatnya:
1. **Front-running / MEV** — bot lihat bid pending di mempool → sandwich → nyedot value.
2. **Free-rider pada pooled rate** — semua lender dapat bunga pool rata-rata → tak ada insentif jujur soal bunga → price discovery rusak.
3. **Posisi telanjang** — kolateral & ambang likuidasi terlihat → liquidation attack + intel kompetitor.

Pendekatan rahasia yang ada (mis. enclave/TEE black-box) menyembunyikan bid — tapi karena black-box **tak bisa diperiksa ulang** & hasilnya tak deterministik, **tak ada yang bisa memverifikasi** matchnya jujur. Kamu hanya bisa *percaya* enclave-nya.

---

## 3. Solusi (apa yang Nelva lakukan)
1. **Sealed-bid rate discovery** — lender submit bunga rahasia; rival tak bisa lihat bid satu sama lain (privasi **struktural** Canton, bukan enkripsi).
2. **Discriminatory (pay-as-bid) pricing** — tiap lender dapat **bunganya sendiri** → bid jujur = strategi dominan.
3. **Deterministic on-ledger matching** — algoritma greedy (lend termurah dulu) jalan sebagai **Daml choice** yang deterministik.
4. **Auditable matching (DIFERENSIATOR)** — Auditor mengeksekusi ulang match yang sama atas **semua bid termasuk yang kalah** → cocok = **badge HIJAU**, operator curang/skip-lend-murah = **badge MERAH**. Pendekatan black-box tak bisa ini (tak bisa di-replay).
5. **Credit tiers + collateral + liquidation** — Bronze→Platinum (kolateral makin efisien), likuidasi otomatis bila tidak sehat.
6. **Lens (fitur visual hero)** — pengganti sudut pandang: Lender / Borrower / Operator / Auditor / Orang-luar melihat data yang BERBEDA dari ledger yang sama → bukti privasi langsung di layar.

---

## 4. Persona / pengguna
| Persona | Peran | Yang dia lihat |
|---|---|---|
| **Lender** | Pasang bid bunga rahasia, danai pinjaman | Hanya bid & posisinya sendiri |
| **Borrower** | Minta pinjaman, taruh kolateral, bayar | Hanya pinjaman & intent-nya sendiri |
| **Matching Operator** | Jalankan match round | Semua bid (pihak tepercaya, BUKAN TEE) |
| **Auditor** | Verifikasi match jujur | Semua bid (termasuk kalah) + hasil match |
| **Orang luar / Juri** | Pengamat | Hanya ringkasan publik (tak ada bid/posisi) |

---

## 5. Fitur (prioritas hackathon)
**MUST (demo spine):**
- F1 Sealed bid (lender, bunga rahasia, dana di-lock).
- F2 Borrow intent (borrower, kolateral di-lock).
- F3 Run match → MatchProposal (discriminatory ticks, deterministik).
- F4 Accept atomik → Loan (dana lender → borrower dalam 1 transaksi, tanpa custody operator).
- F5 **Auditor Verify → badge MERAH/HIJAU** (diferensiator).
- F6 **Lens party-perspective-diff** (FE hero).
- F7 Repay + naik tier.
- F8 Liquidate (oracle harga + seize collateral pro-rata).

**NICE (kalau sempat):** claim-excess collateral, multi-instrument, proof-of-solvency aggregate (Attestor fold).

---

## 6. Diferensiator (kenapa menang)
- Privasi = **inti**, bukan tempelan (killer feature Canton) → cocok Track 1.
- **Auditability** = beat yang **belum ada pemenang Canton** punya.
- Bonus: desain **by-construction** menghindari kelas bug umum di lending (settle atomik, no double-credit, over-collateral di-enforce ledger, dana terkonservasi).

---

## 7. Non-goals / di luar scope
- ❌ Kartu/fiat/Visa nyata, KYC nyata, custody produksi.
- ❌ ZK / FHE / TEE (privasi pakai signatory/observer Canton).
- ❌ Oracle harga produksi → **di-mock** (operator-signed PriceUpdate) untuk demo.
- ❌ Multi-chain / EVM apa pun — **100% Canton**.

---

## 8. Caveat jujur (WAJIB diucapkan di pitch — jangan overclaim)
1. **Operator BISA lihat bid** (bukan TEE-buta) → jaminan = **privasi-dari-rival + kejujuran-match-via-auditor**, BUKAN operator-buta.
2. **Auditor butuh shared key** untuk cleartext rate (MVP; Canton tak punya TEE/ZK).
3. **Dana terkunci saat bid** (ada `WithdrawBid` setelah deadline = anti-grief).
4. **Oracle harga = pihak tepercaya** (mock untuk demo).
5. Ekonomi lending (auction pay-as-bid, credit tier, likuidasi) = pola standar industri/teori lelang; implementasi Nelva **orisinal di Daml**.

---

## 9. Definisi sukses
- Demo live: privasi (Lens diff) + match jujur + **momen MERAH** saat operator curang.
- SC: build + semua Daml Script test hijau (termasuk corrupt-match→MERAH + submitMustFail under-collateral).
- Pitch: 1 kalimat jelas, privasi/audit memimpin, Track 1.

---

## 10. Status saat ini (2026-06-30)
- ✅ **SC lengkap** (Match/Asset/Credit/Lending/Settlement) — **10/10 Daml test hijau**, full lifecycle (bid→match→accept→repay→liquidate→reject-slash→verify GREEN/RED).
- ✅ **Jalan di Canton asli** (dpm sandbox, JSON Ledger API) end-to-end + **privasi per-party kebukti**.
- ✅ **BE gateway** (mock + Canton) tervalidasi end-to-end.
- ⏳ Berikutnya: FE (Lens UI) + deploy live (DevNet/Seaport).
- Detail teknis: `2_TECH_SPEC.md`. Alur & layar: `3_USER_FLOW_WIREFRAME.md`.
