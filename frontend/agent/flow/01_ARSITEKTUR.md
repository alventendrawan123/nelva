# 01 - Arsitektur & Alur Satu Request

## Gambaran besar

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (Next.js, folder frontend/)                          │
│                                                               │
│  Navbar PersonaSwitcher  ──set──►  PartyContext               │
│   (Lender/Borrower/...)            (persona + party token)    │
│                                          │                    │
│  Panel (Borrow/Lend/Lens/Status)         │ baca party         │
│   pakai HOOK (useMyBids dll) ◄───────────┘                    │
│            │                                                  │
│            ▼                                                  │
│  TanStack Query  ──►  api.* (endpoints.ts)  ──►  call() client│
│  (cache+refetch)                                  │           │
└───────────────────────────────────────────────────┼─────────┘
                                                     │ fetch + Bearer
                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Express, folder be/)  http://localhost:8090/api     │
│   server.ts  ──►  ledger (mock | canton)  ──►  store.ts       │
│   - cek role dari Bearer token                                │
│   - balikin data sesuai sudut pandang (privacy di BE!)        │
└─────────────────────────────────────────────────────────────┘
```

Poin penting: **privasi datang dari BE**, bukan disaring di FE. FE tampilkan apa adanya. Outsider gak dikasih bid sama BE -> jadi kosong di layar.

## Siapa "aku"? (Persona -> Party -> Token)

`frontend/src/config/nav.ts` -> `PERSONA_PARTY`:

| Persona (di navbar) | Party (token Bearer) | Role di BE |
|---|---|---|
| Lender | `LenderA` | lender |
| Borrower | `Borrower` | borrower |
| Operator | `Operator` | operator |
| Auditor | `Auditor` | auditor |
| Outsider | (kosong, tanpa token) | outsider |

Klik persona di navbar -> `PartyContext` ganti `party`. Semua hook baca `party` dari context, kirim sebagai `Authorization: Bearer <party>`. BE pakai itu buat tentuin "kamu boleh lihat apa".

> Catatan: aksi Operator (Run Match/Cheat/Seed) dan Auditor (Verify) selalu pakai token Operator/Auditor yang sudah di-hardcode di `endpoints.ts`, jadi tombolnya jalan dari persona mana pun. Cuma dropdown daftar proposal yang ngikut persona aktif.

## Alur satu request (contoh: "Pasang sealed bid")

```
1. User di tab Lend isi amount=100, rate=5, klik Submit.
2. LendPanel panggil usePlaceBid().mutate({amount:100, rate: 5/100})
       (rate diubah ke desimal: 5% -> 0.05)
3. Hook -> api.placeBid("LenderA", 100, 0.05)
4. call() kirim POST /api/bids
       headers: Authorization: Bearer LenderA
       body: {amount:100, rate:0.05, instrument:"USD", durationDays:30}
5. BE (server.ts) terima -> ledger.createBid -> simpan di store.ts -> balikin Bid (201)
6. call() validasi response pakai Zod (bidSchema). Kalau bentuk aneh -> error rapi.
7. Hook onSuccess -> invalidate cache (status, bids, dst) -> query refetch otomatis.
8. UI "My sealed bids" update sendiri tanpa reload.
```

## Lapisan kode (Clean Architecture)

```
frontend/src/
├── config/
│   ├── nav.ts          # daftar persona, party map, nav links, tabs
│   └── env.ts          # URL backend (NEXT_PUBLIC_API_BASE_URL)
├── context/
│   └── PartyContext.tsx# "aku siapa sekarang" (persona + party)
├── lib/
│   ├── api/
│   │   ├── schemas.ts  # Zod: bentuk semua data dari BE (sumber kebenaran tipe)
│   │   ├── client.ts   # fetch mentah + Bearer + timeout + validasi Zod
│   │   ├── endpoints.ts# daftar endpoint (api.placeBid, api.lens, dst)
│   │   └── hooks.ts    # React Query hooks (useMyBids, useRunMatch, dst)
│   ├── format.ts       # rate desimal->%, format uang/tanggal
│   ├── query/Providers.tsx # bungkus app: QueryClient + PartyProvider
│   ├── mock/           # data mock yang TIDAK ada di API (pools, faqs, tokens)
│   └── schemas/mock.ts # Zod buat data mock
├── components/
│   ├── layout/         # Navbar, PersonaSwitcher, WalletPill
│   ├── ui/             # tombol, kartu, badge, dll (dumb components)
│   ├── shared/         # FaqSection, QueryState (loading/error/empty)
│   └── pages/          # isi tiap halaman (lihat 03_PETA_FILE.md)
└── app/                # route Next.js (page.tsx tipis, import dari pages/)
```

Aturan arah ketergantungan: `app` -> `components/pages` -> `components/ui` + `lib`. UI gak tahu soal blockchain. Logika fetch di `lib`. Komponen cuma nampilin.

## Empat state tiap data (wajib)

Tiap daftar/fetch ditangani 4 keadaan pakai `<QueryState>`:
- **loading** -> "Loading..."
- **error** -> pesan + "pastikan BE port 8090 nyala"
- **empty** -> pesan ramah (mis. "No bids yet")
- **success** -> tampilkan data

Jadi kalau BE mati, layar gak putih/blank - tetap kasih pesan jelas.
