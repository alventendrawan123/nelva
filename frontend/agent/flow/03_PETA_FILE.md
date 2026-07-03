# 03 - Peta File (mau ubah X, buka file mana)

## Route (tipis, ~5 baris, cuma import halaman)
- `src/app/page.tsx` -> Home
- `src/app/explore/page.tsx` -> Explore
- `src/app/profile/page.tsx` -> Profile
- `src/app/layout.tsx` -> navbar + bungkus `<Providers>` (React Query + Party)
- `src/app/globals.css` -> design token (warna, radius, shadow), cursor pointer global

## Halaman & komponennya
```
src/components/pages/
├── Home/index.tsx                 # rakit tab + FAQ
│   └── components/
│       ├── HomeTabs.tsx           # switch tab + animasi pindah panel
│       ├── BorrowPanel.tsx        # form borrow + proposals + loans
│       ├── LendPanel.tsx          # form sealed bid + my bids
│       ├── LensPanel.tsx          # HERO: Run/Cheat/Seed/Verify + 5 kolom
│       ├── StatusPanel.tsx        # status publik + posisi
│       ├── PanelHeading.tsx       # judul + subjudul tiap panel
│       └── SealedHint.tsx         # baris hint gembok
├── Explore/index.tsx
│   └── components/ ExploreHero (stat live) · FeaturedPools · PoolFilters · PoolTable
└── Profile/index.tsx
    └── components/ ProfileHeader · ProfileStats · ActivePositions · CreditHistory · PrivateWallet · PositionsList
```

## Mau ubah ini -> buka file ini

| Mau ubah... | File |
|---|---|
| URL backend / port | `src/config/env.ts` (+ `.env.local` set `NEXT_PUBLIC_API_BASE_URL`) |
| Persona <-> party (mis. tambah LenderB) | `src/config/nav.ts` (`PERSONAS`, `PERSONA_PARTY`) |
| Nama tab / nav link | `src/config/nav.ts` |
| Tambah/ubah endpoint API | `src/lib/api/endpoints.ts` |
| Bentuk data dari BE (validasi) | `src/lib/api/schemas.ts` |
| Cara fetch (timeout, header, error) | `src/lib/api/client.ts` |
| Hook data / kapan refetch / invalidate | `src/lib/api/hooks.ts` |
| Format rate (% ) / uang | `src/lib/format.ts` |
| Warna / border / shadow / tema | `src/app/globals.css` (token) |
| Tombol, kartu, badge, input | `src/components/ui/*` |
| Loading/error/empty look | `src/components/shared/QueryState.tsx` |
| Isi FAQ | `src/lib/mock/faqs.ts` |
| Pools di Explore (mock, no API) | `src/lib/mock/pools.ts` |
| Animasi (tab, badge, accordion) | komponen masing-masing (framer-motion) |

## Hook -> endpoint -> BE route (cheat sheet)

| Hook (FE) | api.* | BE route |
|---|---|---|
| `useStatus` | `api.status` | GET /api/status |
| `useMyBids` | `api.myBids` | GET /api/bids (Bearer) |
| `usePlaceBid` | `api.placeBid` | POST /api/bids |
| `useMyBorrows` | `api.myBorrows` | GET /api/borrow |
| `useBorrow` | `api.borrow` | POST /api/borrow |
| `useProposals` | `api.proposals` | GET /api/proposals |
| `useAccept` / `useReject` | `api.accept` / `api.reject` | POST /api/proposals/:id/accept|reject |
| `useLoans` | `api.loans` | GET /api/loans |
| `useRepay` | `api.repay` | POST /api/loans/:id/repay |
| `useRunMatch` | `api.runMatch` | POST /api/admin/run-match (Operator) |
| `useCheatMatch` | `api.cheatMatch` | POST /api/admin/cheat-match (Operator) |
| `useSeed` | `api.seed` | POST /api/admin/seed (Operator) |
| `useVerify` | `api.verify` | POST /api/audit/verify/:id (Auditor) |
| `useLens` | `api.lens` | GET /api/lens?proposalId= |
| `useProfile` | (gabungan loans+bids+borrows) | beberapa GET |

## Catatan penting
- **Rate disimpan desimal** (0.05 = 5%). Input form pakai %, dikali/bagi 100 di FE (`parseRatePercent` / `formatRate`).
- **Uang ditampilkan apa adanya** dari BE, jangan dihitung ulang.
- **`src/lib/mock/`** = data yang TIDAK disediakan API (pools, faqs, token). Sisanya semua live dari BE.
- BE kontrak lengkap ada di `docs/planUntukBroBimaWIN.md` (§5 types, §6 api, §7 tabel route).
