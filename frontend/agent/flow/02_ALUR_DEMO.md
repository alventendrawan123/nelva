# 02 - Alur Demo (klik per klik)

Tujuan: ngerti urutan dari nol sampai momen MERAH. Pastikan BE nyala dulu (lihat README).

## Peta tab Home

| Tab | Untuk persona | Isi |
|---|---|---|
| **Borrow** | Borrower | form minta pinjam + daftar Match Proposal (Accept/Reject) + Your Loans (Repay) |
| **Lend** | Lender | form pasang sealed bid + daftar My Sealed Bids |
| **Lens** | Operator/Auditor (hero) | Run Match / Cheat / Seed + 5 kolom sudut pandang + Auditor Verify |
| **Status** | siapa saja | angka pasar publik + posisi aktif kamu |

Ingat: ganti **persona di navbar** sebelum tiap langkah. Persona = "aku sekarang".

---

## Alur lengkap (spine demo ~3 menit)

### Langkah 0 - Reset data (opsional)
Persona **Operator** -> tab **Lens** -> tombol **Seed Demo Data**.
Data balik ke awal: LenderA 100@3%, LenderB 100@5%, Borrower minta 150.

### Langkah 1 - Lender pasang bid rahasia
Persona **Lender** -> tab **Lend**.
- Amount `100`, Your Rate `5`, Submit Sealed Bid.
- Muncul di "My sealed bids" status OPEN.
- Pesan: "rate kamu disegel, rival gak lihat".

> Seed sudah bikin 2 bid (LenderA, LenderB), jadi ini opsional buat nambah.

### Langkah 2 - Borrower minta pinjam
Persona **Borrower** -> tab **Borrow**.
- Amount `150`, Collateral `300`, Max Rate `6`, Submit Borrow Intent.
- (collateral harus > 0, kalau 0 -> BE tolak "must be a positive number".)

### Langkah 3 - Operator jalankan match
Persona **Operator** -> tab **Lens** -> **Run Match**.
- Muncul proposal (mis. P-4) + 5 kolom kebuka:
  - **Lender**: cuma bid sendiri.
  - **Borrower**: principal 150, blended 3.67%.
  - **Operator**: SEMUA bid (LenderA 3%, LenderB 5%).
  - **Auditor**: semua bid (termasuk yang kalah).
  - **Outsider**: cuma "Active loans", bid & rate HIDDEN. <- bukti privasi.

### Langkah 4 - Auditor verifikasi (jujur -> HIJAU)
Masih di Lens -> **Auditor Verify**.
- Badge **HIJAU** di kolom Auditor + alasan "recomputed match equals published".
- Artinya match jujur, urutan termurah dihormati.

### Langkah 5 - Borrower terima -> jadi Loan
Persona **Borrower** -> tab **Borrow** -> bagian "Match proposals" -> **Accept**.
- Loan muncul di "Your loans" status ACTIVE (1 transaksi atomik, no custody).
- (Repay -> naik tier nanti.)

### Langkah 6 - KLIMAKS: Operator curang -> Auditor tangkap (MERAH)
Persona **Operator** -> tab **Lens** -> **Cheat Match**.
- Dropdown otomatis pindah ke proposal cheat (mis. P-5) yang skip lender murah.
- Klik **Auditor Verify** -> badge **MERAH** + alasan "a cheaper lend was skipped".
- Narasi penutup: **"Privat, tapi kalau operator curang -> ketahuan."**

---

## Diagram status data (state machine)

```
Bid:          OPEN ──(match)──► MATCHED
                └──(withdraw)──► WITHDRAWN

BorrowIntent: OPEN ──(accept proposal)──► MATCHED

Proposal:     PENDING ──(accept)──► ACCEPTED ──► jadi Loan
                   └──(reject)──► REJECTED

Loan:         ACTIVE ──(repay)──► REPAID  (tier naik)
                  └──(liquidate)──► LIQUIDATED (tier turun)

AuditBadge:   (verify) ──► GREEN  (jujur)
                       └─► RED    (curang)
```

## Kenapa kadang "kayak gak terjadi apa-apa"?

- **Verify di proposal jujur** -> selalu HIJAU. Klik lagi = HIJAU lagi (badge re-pop tiap klik, tapi warna sama). Buat MERAH: harus Cheat Match dulu, lalu verify proposal cheat.
- **Dropdown proposal kosong** -> persona aktif gak boleh lihat proposal (mis. Lender cuma lihat proposal yg dia ikut). Ganti ke Operator/Auditor buat lihat semua. Run/Cheat/Verify tetap jalan dari persona mana pun.
- **Form error merah** -> itu pesan asli dari BE (mis. collateral 0). Tandanya integrasi FE<->BE jalan.
