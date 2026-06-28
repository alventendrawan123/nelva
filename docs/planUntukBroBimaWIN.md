# 🏆 Plan LENGKAP untuk Bima — Frontend (FE) Nelva sampai MENANG

> Panduan FE end-to-end. Otak + mesin (Daml di Canton) + backend (REST API) **udah jadi & teruji**.
> Tugas kamu = **wajah** Nelva. Itu yang paling dinilai juri ("Could a real user use this? Interface clear?").
> Semua yang kamu butuh ada di sini: types, API, contoh kode, layar, sampai script demo. Tinggal eksekusi.

---

## 0. Mindset (baca ini biar tenang)
- **Kamu TIDAK nyentuh blockchain/Daml.** Cuma **fetch REST API** biasa.
- Backend auto-seed data contoh → begitu nyala, langsung ada 2 lender + 1 borrower.
- Privasi **datang dari backend** — kamu **tampilkan apa adanya per sudut pandang**, jangan filter sendiri.
- **UI rapi + alur jelas + 1 momen "wow" (badge MERAH) = menang.**

---

## 1. Nelva = apa + 5 pemain
Pasar **pinjam-meminjam rahasia**: lender pasang bunga diam-diam → operator jodohin → auditor buktiin jujur.

| Pemain (party) | Token login | Lihat apa |
|---|---|---|
| `LenderA`, `LenderB` | `Bearer LenderA` | cuma bid & loan-nya sendiri |
| `Borrower` | `Bearer Borrower` | intent/proposal/loan-nya sendiri |
| `Operator` | `Bearer Operator` | semua bid + kontrol match (admin) |
| `Auditor` | `Bearer Auditor` | semua bid (termasuk kalah) + verify |
| Outsider | (tanpa token) | cuma status publik (tanpa bid/posisi) |

---

## 2. Stack + Setup
**Stack:** React 18 + Vite + TypeScript + Tailwind + **shadcn/ui** + (opsional) framer-motion buat animasi.

**Nyalain backend (terminal 1):**
```bash
cd d:\nelva\be && npm install && npm run dev
# → http://localhost:8090 , auto-seed. cek: http://localhost:8090/api/status
```

**Bikin FE (terminal 2):**
```bash
cd d:\nelva
npm create vite@latest fe -- --template react-ts
cd fe && npm install
npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
# setup shadcn: npx shadcn@latest init   lalu  npx shadcn@latest add button card input table badge tabs dialog
npm install framer-motion        # buat animasi badge (opsional tapi recommended)
npm run dev
```

---

## 3. Struktur folder FE (saran)
```
fe/src/
├── lib/
│   ├── api.ts          # fetch client (copy dari §6)
│   └── types.ts        # types (copy dari §5)
├── context/
│   └── PartyContext.tsx # siapa "aku" sekarang (sudut pandang aktif)
├── components/
│   ├── TopBar.tsx       # + Party Switcher
│   ├── BadgeVerdict.tsx # HIJAU/MERAH + animasi
│   └── ...
├── pages/
│   ├── LenderPage.tsx
│   ├── BorrowerPage.tsx
│   ├── OperatorPage.tsx
│   ├── AuditorPage.tsx
│   ├── LensPage.tsx     # ⭐ HERO
│   └── StatusPage.tsx
└── App.tsx              # routing/tabs
```

---

## 4. (catatan) angka & uang
- Amount/rate dikirim & diterima sebagai **number** biasa (mock). Tampilkan apa adanya.
- Rate itu desimal: `0.05` = 5%. Tampilkan `*100` + "%" kalau mau (`0.05 → 5%`).
- Jangan hitung ulang uang di FE; tampilkan dari API.

---

## 5. TypeScript Types (copy ke `lib/types.ts`)
```ts
export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface Bid {
  bidId: string; lender: string; amount: number; rate: number;
  instrument: string; status: "OPEN" | "MATCHED" | "WITHDRAWN"; deadline: string;
}
export interface BorrowIntent {
  borrowId: string; borrower: string; amount: number; maxRate: number;
  tier: Tier; requiredCollateral: number; collateralAmount: number;
  instrument: string; status: "OPEN" | "MATCHED";
}
export interface Tick { lender: string; bidId: string; amount: number; rate: number; }
export interface MatchProposal {
  proposalId: string; borrowId: string; borrower: string; principal: number;
  blendedRate: number; tier: Tier; ticks: Tick[]; inputBidIds: string[];
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}
export interface Loan {
  loanId: string; borrower: string; principal: number; blendedRate: number;
  ticks: Tick[]; collateralAmount: number; tier: Tier; maturity: string;
  status: "ACTIVE" | "REPAID" | "LIQUIDATED";
}
export interface AuditBadge {
  proposalId: string; verdict: "GREEN" | "RED"; reason: string; auditor: string; checkedAt: string;
}
export interface Status { openBids: number; activeLoans: number; proposals: number; lastMatchAt: string | null; }

export interface LensView {
  subject: { proposalId: string; borrower: string; principal: number } | null;
  perspectives: {
    lender:   { party: string | null; canSee: string[]; bids: Bid[] };
    borrower: { party: string | null; canSee: string[]; proposal: MatchProposal | null };
    operator: { canSee: string[]; bids: Bid[]; proposal: MatchProposal | null };
    auditor:  { canSee: string[]; bids: Bid[]; badge: AuditBadge | null };
    outsider: { canSee: string[]; status: Status };
  };
}
```

---

## 6. Fetch client (copy ke `lib/api.ts`)
```ts
const BASE = "http://localhost:8090/api";

async function call<T>(path: string, opts: { method?: string; party?: string; body?: any } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(opts.party ? { Authorization: `Bearer ${opts.party}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

export const api = {
  status:   () => call<import("./types").Status>("/status"),
  // lender
  myBids:   (party: string) => call<import("./types").Bid[]>("/bids", { party }),
  placeBid: (party: string, amount: number, rate: number) =>
              call("/bids", { party, body: { amount, rate, instrument: "USD", durationDays: 30 } }),
  // borrower
  myBorrows:(party: string) => call<import("./types").BorrowIntent[]>("/borrow", { party }),
  borrow:   (party: string, amount: number, maxRate: number, collateralAmount: number) =>
              call("/borrow", { party, body: { amount, maxRate, collateralAmount, instrument: "USD" } }),
  proposals:(party: string) => call<import("./types").MatchProposal[]>("/proposals", { party }),
  accept:   (party: string, id: string) => call<import("./types").Loan>(`/proposals/${id}/accept`, { party, method: "POST" }),
  reject:   (party: string, id: string) => call(`/proposals/${id}/reject`, { party, method: "POST" }),
  loans:    (party: string) => call<import("./types").Loan[]>("/loans", { party }),
  repay:    (party: string, id: string) => call(`/loans/${id}/repay`, { party, method: "POST" }),
  // operator (HARUS party = "Operator")
  runMatch:   () => call<{ proposals: import("./types").MatchProposal[] }>("/admin/run-match", { party: "Operator", method: "POST" }),
  cheatMatch: () => call<{ proposals: import("./types").MatchProposal[] }>("/admin/cheat-match", { party: "Operator", method: "POST" }),
  setPrice:   (price: number) => call("/admin/price", { party: "Operator", body: { instrument: "USD", price } }),
  liquidate:  (loanId: string) => call(`/admin/liquidate/${loanId}`, { party: "Operator", method: "POST" }),
  seed:       () => call("/admin/seed", { party: "Operator", method: "POST" }),
  // auditor (HARUS party = "Auditor")
  auditBids: () => call<import("./types").Bid[]>("/audit/bids", { party: "Auditor" }),
  verify:    (proposalId: string) => call<import("./types").AuditBadge>(`/audit/verify/${proposalId}`, { party: "Auditor", method: "POST" }),
  badges:    () => call<import("./types").AuditBadge[]>("/audit/badges", { party: "Auditor" }),
  // hero
  lens:      (proposalId: string) => call<import("./types").LensView>(`/lens?proposalId=${proposalId}`),
};
```

---

## 7. API Reference lengkap (method · path · role · request → response)
| Method | Path | Role wajib | Request body | Response |
|---|---|---|---|---|
| GET | `/status` | — | — | `Status` |
| GET | `/health` | — | — | `{ok, mode}` |
| POST | `/login` | — | `{party}` | `{token, party, role}` |
| GET | `/me` | (token) | — | `{party, role}` |
| POST | `/bids` | lender | `{amount, rate, instrument?, durationDays?}` | `Bid` (201) |
| GET | `/bids` | (token) | — | `Bid[]` (lender=miliknya · op/auditor=semua · lain=[]) |
| DELETE | `/bids/:id` | lender | — | `{bidId, status:"WITHDRAWN"}` *(mock; canton: cuma setelah deadline)* |
| POST | `/borrow` | borrower | `{amount, maxRate, collateralAmount, instrument?}` | `BorrowIntent` (201) |
| GET | `/borrow` | (token) | — | `BorrowIntent[]` |
| GET | `/proposals` | (token) | — | `MatchProposal[]` (borrower & matched-lender lihat punyanya · op/auditor semua) |
| POST | `/proposals/:id/accept` | borrower | — | `Loan` |
| POST | `/proposals/:id/reject` | borrower | — | `{proposalId, status:"REJECTED"}` |
| GET | `/loans` | (token) | — | `Loan[]` |
| POST | `/loans/:id/repay` | borrower | — | `{loanId, status:"REPAID", newTier}` |
| POST | `/admin/run-match` | **operator** | — | `{proposals: MatchProposal[]}` |
| POST | `/admin/cheat-match` | **operator** | — | `{proposals: MatchProposal[]}` |
| POST | `/admin/price` | **operator** | `{instrument, price}` | `{instrument, price}` |
| POST | `/admin/liquidate/:loanId` | **operator** | — | `{loanId, status, distribution, fee, newTier}` |
| POST | `/admin/seed` | **operator** | — | `{ok:true}` |
| GET | `/audit/bids` | **auditor** | — | `Bid[]` (semua, incl loser) |
| POST | `/audit/verify/:proposalId` | **auditor** | — | `AuditBadge` (`verdict:"GREEN"\|"RED"`) |
| GET | `/audit/badges` | **auditor** | — | `AuditBadge[]` |
| GET | `/lens?proposalId=` | — | — | `LensView` |

**Data seed awal:** LenderA bid 100 @ 3% · LenderB bid 100 @ 5% · Borrower minta 150 (maxRate 6%, kolateral 300) · harga USD = 1.0.

---

## 8. Per-Layar: apa ditampilkan + API + komponen
> Wireframe ASCII tiap layar ada di **`3_USER_FLOW_WIREFRAME.md`** (peta visual). Ringkasan:

### 8.1 TopBar + Party Switcher (komponen global)
- Tombol: Lender A / Lender B / Borrower / Operator / Auditor / Outsider.
- Klik → simpan party aktif di `PartyContext`. Semua page baca dari sini.
- shadcn: `Tabs` atau group `Button`.

### 8.2 Lender Page (`Bearer LenderA`/`LenderB`)
- **Form "Pasang Tawaran"**: input amount + rate(%) → `api.placeBid(party, amount, rate/100)`.
- **List tawaranku**: `api.myBids(party)` → tabel (amount, rate%, status). Tunjuk "🔒 rahasia".
- shadcn: `Card`, `Input`, `Button`, `Table`, `Badge`.

### 8.3 Borrower Page (`Bearer Borrower`)
- **Form "Minta Pinjam"**: amount, maxRate(%), collateral → `api.borrow(...)`.
- **Match Proposal**: `api.proposals("Borrower")` → kartu {principal, blendedRate%, ticks per-lender} + tombol **Accept**(`api.accept`) / **Reject**(`api.reject`).
- **Loans**: `api.loans("Borrower")` → list + tombol **Repay**(`api.repay`).

### 8.4 Operator Page (`Bearer Operator`) — panel kontrol/demo
- Tombol: **Run Match** (`api.runMatch`) · **Cheat Match** (`api.cheatMatch`) · **Set Price** (`api.setPrice`) · **Liquidate** (pilih loan → `api.liquidate`).
- Tampilkan semua bid + proposals (operator lihat semua).

### 8.5 Auditor Page (`Bearer Auditor`) — diferensiator
- List semua bid (`api.auditBids`) — termasuk yang KALAH.
- Pilih proposal → tombol **Verify** (`api.verify(proposalId)`) → tampil `<BadgeVerdict verdict={...}/>`:
  - `GREEN` → hijau "✓ Match jujur".
  - `RED` → merah "✗ MISMATCH" + `reason`. **Animasi pop.**

### 8.6 ⭐ Lens Page (HERO) — §9

### 8.7 Status Page (outsider)
- `api.status()` → {openBids, activeLoans} doang. **Tanpa bid/rate** → bukti privasi.

---

## 9. ⭐ LENS PAGE (fitur yang bikin MENANG)
Panggil `api.lens(proposalId)` → `LensView` (§5). Render **5 kolom bersebelahan**, satu per sudut pandang.
Tiap kolom tampilkan field `bids`/`proposal`/`badge`/`status` yang ada di perspektif itu.

**Aturan tampil:**
- **Lender**: `perspectives.lender.bids` = cuma bid dia (1 baris).
- **Borrower**: `perspectives.borrower.proposal` = proposal-nya.
- **Operator**: `perspectives.operator.bids` = SEMUA bid + rate.
- **Auditor**: `perspectives.auditor.bids` (semua incl loser) + `badge.verdict`.
- **Outsider**: `perspectives.outsider.status` = angka doang, **kosong soal bid/rate**.

**Warnai sel:** 🟢 banyak yang lihat · 🟡 cuma 1 pihak · ⬜ disembunyikan (kolom outsider).

**Money shot:**
1. Operator klik **Run Match** → ada proposal → buka Lens-nya → tunjuk "Outsider kosong, rival ga lihat".
2. Operator klik **Cheat Match** → buka proposal cheat di Lens → Auditor **Verify** → **badge 🔴 MERAH (animasi)**.
3. Narasi: *"Privat, tapi kalau operator curang → ketahuan."*

**Contoh `<BadgeVerdict>` (framer-motion):**
```tsx
import { motion } from "framer-motion";
export function BadgeVerdict({ verdict, reason }: { verdict?: "GREEN"|"RED"; reason?: string }) {
  if (!verdict) return null;
  const green = verdict === "GREEN";
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`rounded-xl px-4 py-3 font-bold ${green ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {green ? "✓ GREEN — match jujur" : "✗ RED — MISMATCH"}
      {reason && <div className="text-xs font-normal mt-1 opacity-80">{reason}</div>}
    </motion.div>
  );
}
```

---

## 10. State & refresh
- **PartyContext**: simpan party aktif (default "LenderA"). Switcher ganti ini.
- Tiap page `useEffect(load, [party])` → fetch ulang pas ganti party/aksi.
- Setelah aksi (placeBid/accept/runMatch/verify) → **refetch** data terkait.
- Cukup `useState` + `useEffect`. (React Query opsional kalau mau auto-refetch rapi.)

---

## 11. UX & estetika (ini yang dinilai)
- 1 warna aksen (mis. indigo) + netral (slate). Konsisten.
- Spacing lega, kartu ber-shadow tipis, font enak (shadcn default udah bagus).
- **Status pakai warna**: OPEN=biru, MATCHED=hijau, RED badge=merah mencolok.
- **Animasi** cuma di momen kunci (badge MERAH, proposal muncul) — jangan lebay.
- **Loading**: skeleton/spinner. **Empty**: pesan ramah ("Belum ada tawaran").
- **Error**: toast/alert merah dgn pesan dari API.
- Responsif minimal di laptop (demo).

---

## 12. Script Demo 3 menit (latihan sama Jeje)
1. (15s) Buka **Lens** → "ledger sama, tiap pihak lihat beda" → tunjuk Outsider kosong.
2. (30s) **Lender A & B** pasang tawaran rahasia → rival ga saling lihat.
3. (30s) **Operator → Run Match** → proposal (tiap lender bunga sendiri).
4. (30s) **Borrower → Accept** → loan jadi (1 transaksi, aman).
5. (45s) **KLIMAKS:** Operator **Cheat** → Auditor **Verify** → **🔴 MERAH**.
6. (30s) Penutup: 1 kalimat jualan + Track 1 (Private DeFi).

---

## 13. Rencana harian (kira-kira 5 hari)
- **Hari 1:** Setup (Vite+Tailwind+shadcn) · `types.ts` + `api.ts` · PartyContext + TopBar/switcher · Status page.
- **Hari 2:** Lender page (bid) + Borrower page (request + lihat proposal).
- **Hari 3:** Accept/Repay + Operator panel (run-match/cheat/price/liquidate).
- **Hari 4:** Auditor console + `<BadgeVerdict>` + **Lens page (5 kolom)**.
- **Hari 5:** Poles (animasi MERAH, warna, loading/empty/error) + latihan demo.

---

## 14. Checklist
- [ ] Vite+Tailwind+shadcn jalan · `types.ts` + `api.ts` siap
- [ ] PartyContext + TopBar switcher
- [ ] Status page (outsider)
- [ ] Lender: pasang bid + list bid sendiri
- [ ] Borrower: minta pinjam + proposal + Accept/Reject + Repay
- [ ] Operator: run-match / cheat / price / liquidate
- [ ] Auditor: verify → BadgeVerdict HIJAU/MERAH
- [ ] ⭐ Lens 5-kolom + warna diff + animasi MERAH
- [ ] Loading/empty/error semua ketangani
- [ ] Latihan demo 3 menit

---

## 15. Troubleshooting
- **Ga ada data?** Pastiin BE jalan (`npm run dev` di `be/`) → cek `http://localhost:8090/api/status`. Reset data: Operator → Seed.
- **403?** Salah role: admin butuh `Bearer Operator`, audit butuh `Bearer Auditor`.
- **CORS error?** BE udah `cors()` kebuka — kalau masih, cek BE jalan + URL benar.
- **Angka aneh?** Rate itu desimal (0.05=5%). Tampilin `*100`.
- **Detail data/endpoint** → `2_TECH_SPEC.md` §5–6 · **wireframe** → `3_USER_FLOW_WIREFRAME.md` · **konsep** → `1_PRD.md`.

---

**Mesin + brankas + wasit (blockchain) udah jadi & teruji. Kamu pegang wajahnya — bagian yang paling dilihat juri.
UI kece + momen MERAH = kita MENANG. Gas, Bima! 🚀**
