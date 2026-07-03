# Nelva FE - Panduan Alur (baca ini dulu)

Folder ini menjelaskan alur Nelva dari awal sampai akhir, biar gak bingung.

Baca urut:

1. [01_ARSITEKTUR.md](./01_ARSITEKTUR.md) - gambaran besar: bagian apa ngomong ke apa (FE -> BE -> Ledger), dan satu request itu lewat mana aja.
2. [02_ALUR_DEMO.md](./02_ALUR_DEMO.md) - skrip demo klik-per-klik (Lend -> Match -> Accept -> Cheat -> Verify MERAH). Ini yang dinilai juri.
3. [03_PETA_FILE.md](./03_PETA_FILE.md) - file mana ngapain, biar gampang cari kalau mau ubah sesuatu.

## TL;DR (30 detik)

- **Nelva** = pasar pinjam-meminjam rahasia di Canton. Lender pasang bunga diam-diam, operator jodohin, auditor buktiin jujur.
- **FE (folder `frontend`)** cuma "wajah". Tidak nyentuh blockchain. Cuma fetch REST API ke BE.
- **BE (folder `be`)** = gateway. Mode `mock` = data di memori, auto-seed pas nyala. Mode `canton` = Canton beneran.
- **Siapa "aku"** ditentukan **Persona Switcher** di navbar (Lender/Borrower/Operator/Auditor/Outsider). Persona -> dikirim sebagai `Authorization: Bearer <party>` ke BE. BE balikin data sesuai sudut pandang itu.
- **Momen MENANG** = tab Lens -> Cheat Match -> Auditor Verify -> badge **MERAH**. "Privat, tapi kalau curang ketahuan."

## Cara nyalain (2 terminal)

```bash
# Terminal 1 - backend
cd be && pnpm install && PORT=8090 npx tsx src/server.ts
# cek: http://localhost:8090/api/status

# Terminal 2 - frontend
cd frontend && pnpm dev
# buka: http://localhost:3000
```

Kalau FE munculin error "Make sure the Nelva backend is running on port 8090" -> berarti BE belum nyala.
