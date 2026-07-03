# Nelva Frontend, Mock UI Plan

> Phase: static mock UI with hardcoded mock data (no backend, no chain). Visual style adapted from the GHOST reference screenshots; all copy and domain content come from `docs/1_PRD.md` and `frontend/agent/submission/project-description.md`. Design rules from `frontend/agent/rules/rules.template.md` are binding.

## 0. Locked Decisions

| Question | Decision |
| --- | --- |
| Home 3rd tab (was GHOST "Swap & Bridge") | **Lens** (PRD F6, the hero differentiator) |
| Pages built this phase | **All three**: Home, Explore, Profile |
| Persona UI | **Persona switcher in navbar** (Lender / Borrower / Operator / Auditor / Outsider) alongside the wallet pill |

Home tab order: **Borrow / Lend / Lens / Status**, followed by an **FAQs** section (present on every tab, matching the reference).

## 1. Goal & Non-Goals

**Goal:** ship a polished, responsive, dark-theme mock of three routes that visually echo the reference screenshots but carry Nelva's sealed-bid lending domain. Mock data only. Every component reads from typed fixtures so wiring a real backend later is a drop-in.

**Non-goals this phase:**
- No backend / JSON Ledger API / wallet connection (the wallet pill and persona switcher are visual + local state only).
- No swap/bridge (Nelva is 100% Canton, no EVM/bridge per PRD §7).
- No real auth, no data fetching library yet (no server state exists to manage).
- No tests yet beyond type-check + lint passing (add later when logic appears).

## 2. Brand & Content Mapping (GHOST -> Nelva)

| Reference element | Nelva replacement (source) |
| --- | --- |
| GHOST logo/wordmark | Nelva wordmark + `public/assets/images/logo/nelva-logo.png` |
| Tabs Borrow / Lend / Swap / Status | Borrow / Lend / **Lens** / Status |
| "Borrow with Privacy" | Borrow intent: amount, max rate, collateral, duration; copy from PRD A2/F2 |
| "Lend privately on GHOST" | Place **sealed bid**: amount, secret rate, duration; PRD A1/F1 |
| Swap & Bridge | **Lens**: 5-party perspective diff + Cheat & Re-Audit money shot; PRD A5/B5/F6 |
| "Your Positions" / Status | Active intents, loans, payouts; PRD A3/B3/B6 |
| Explore GHOST Pools | Explore Nelva markets (sealed-bid pool stats: open bids, borrow intents, last match) |
| Profile (REP score, tiers, Bronze) | Borrower credit tiers Bronze->Platinum, collateral multiplier, rep; PRD F5/F7 |
| Tokens gUSD / gETH | **nUSD** (cash, mocked mint) + collateral asset; PRD uses USD/collateral |
| Networks Sepolia | **Canton** (LocalNet) |
| FAQ "What is GHOST Protocol?" | "What is Nelva?" etc., answers from submission doc incl. honest caveats (PRD §8) |

Token symbols used in mock: `nUSD` (primary cash). Collateral shown as `nUSD` value per PRD B2 (collateral in USD). No `gETH` analogue needed; if a second asset is wanted for the Borrow collateral selector, use `COLL` as a generic collateral token label.

## 3. File Structure

Per user instruction #2: page components live in `src/components/pages/<Page>/`, each is a folder with an `index.tsx` (the public entry) plus a `components/` subfolder for its parts. Each `src/app` route file imports the page index in ~5 lines.

```
frontend/src/
├── app/
│   ├── layout.tsx               # update: Nelva metadata, fonts, Navbar mount, dark theme
│   ├── globals.css              # update: Nelva design tokens (@theme)
│   ├── page.tsx                 # ~5 lines -> renders <HomePage/>
│   ├── explore/page.tsx         # ~5 lines -> renders <ExplorePage/>
│   └── profile/page.tsx         # ~5 lines -> renders <ProfilePage/>
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx           # logo, nav links, notif bell, PersonaSwitcher, WalletPill
│   │   ├── PersonaSwitcher.tsx  # client: 5 personas, active highlight (local state)
│   │   └── WalletPill.tsx       # static 0xebFA...4179 style pill
│   │
│   ├── ui/                      # shared design-system primitives (no domain logic)
│   │   ├── Button.tsx           # variants: primary (lavender), secondary, ghost
│   │   ├── Card.tsx             # surface + border + radius token wrapper
│   │   ├── TabSwitcher.tsx      # client: segmented pill control (Borrow/Lend/Lens/Status)
│   │   ├── AmountField.tsx      # large number input + token/suffix slot
│   │   ├── TokenSelect.tsx      # token chip dropdown (visual)
│   │   ├── Badge.tsx            # status/tier/verdict badges (success/danger/warning/info)
│   │   ├── StatTile.tsx         # label + big number tile (Profile/Explore stats)
│   │   └── Accordion.tsx        # client: FAQ accordion item
│   │
│   └── pages/
│       ├── Home/
│       │   ├── index.tsx        # HomePage: centered column, <HomeTabs/> + <FaqSection/>
│       │   └── components/
│       │       ├── HomeTabs.tsx      # client: TabSwitcher + active panel switch
│       │       ├── BorrowPanel.tsx
│       │       ├── LendPanel.tsx
│       │       ├── LensPanel.tsx     # HERO: 5-col diff + Cheat & Re-Audit
│       │       └── StatusPanel.tsx
│       ├── Explore/
│       │   ├── index.tsx
│       │   └── components/
│       │       ├── ExploreHero.tsx   # title + 3 headline stats + ghost art
│       │       ├── FeaturedPools.tsx # cards + prev/next controls
│       │       ├── PoolFilters.tsx   # Token / Network / Status dropdowns + search
│       │       └── PoolTable.tsx
│       └── Profile/
│           ├── index.tsx
│           └── components/
│               ├── ProfileHeader.tsx     # address, tier badge, rep score, tier progress
│               ├── ProfileStats.tsx      # 5 StatTiles row
│               ├── ActivePositions.tsx   # simple bar chart (Lending/Borrowing/Intents)
│               ├── CreditHistory.tsx     # empty state "No loan history yet"
│               ├── PrivateWallet.tsx     # "Fetch Balances" CTA (mock reveal)
│               └── PositionsList.tsx     # "Your Positions" empty state
│
├── components/shared/
│   └── FaqSection.tsx           # shared across Home tabs (Accordion list)
│
├── lib/
│   ├── schemas/
│   │   └── mock.ts              # Zod schemas for all mock shapes (single source of truth)
│   └── mock/
│       ├── pools.ts            # Explore markets fixtures
│       ├── profile.ts          # Profile fixtures
│       ├── faqs.ts             # FAQ Q/A fixtures (Nelva content)
│       ├── lens.ts             # 5-party Lens rows + verdict states
│       └── tokens.ts           # token metadata (nUSD, COLL)
│
├── config/
│   └── nav.ts                  # nav links + persona list constants
│
└── types/
    └── domain.ts               # z.infer types re-exported from schemas
```

Note: `FaqSection` is shared by all four Home tabs, so it lives in `components/shared/` per rules §3 (shared by >2 consumers). Page-private parts stay under each page's `components/`.

### 5-line route pattern (example `app/page.tsx`)

```tsx
import type { Metadata } from "next";
import { HomePage } from "@/components/pages/Home";

export const metadata: Metadata = { title: "Nelva", description: "Private sealed-bid lending on Canton" };
export default function Page() { return <HomePage />; }
```

`src/components/pages/Home/index.tsx` exports a named `HomePage`. Same shape for `explore/page.tsx` -> `ExplorePage`, `profile/page.tsx` -> `ProfilePage`.

## 4. Design Tokens (rules §6: tokens, never hex in components)

Define once in `globals.css` `@theme`. Dark theme is the base (reference is dark-only); we drop the light/dark auto-switch from the current starter. Palette derived from the screenshots.

| Role | Token | Value (approx) |
| --- | --- | --- |
| Page background | `--color-bg` | near-black `#0a0a0a` |
| Card / surface | `--color-surface` | `#141416` |
| Raised input surface | `--color-surface-2` | `#1c1c1f` |
| Border / divider | `--color-border` | `#262629` |
| Primary text | `--color-text` | `#f4f4f5` |
| Muted text | `--color-text-muted` | `#9b9ba3` |
| Primary action (CTA) | `--color-primary` | lavender `#c9a8e0` |
| On-primary text | `--color-primary-foreground` | `#1a1322` |
| Brand accent (icons, pills, FAQ +) | `--color-accent` | violet `#8b5cf6` |
| Wallet pill bg | `--color-wallet` | light lavender `#e9d5ff` |
| Success / GREEN verdict / active pool | `--color-success` | `#34d399` |
| Danger / RED verdict | `--color-danger` | `#ef4444` |
| Warning / Bronze tier | `--color-warning` | `#f59e0b` |

Radius tokens: `--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 20px`, `--radius-full 9999px`. Spacing follows the 4px scale (rules §7). Fonts: keep Geist sans + mono via `next/font` (rules §10). Components consume tokens through Tailwind v4 utility classes mapped to these CSS vars (e.g. `bg-surface`, `text-muted`, `bg-primary`). No raw hex in JSX.

## 5. Mock Data Shapes (Zod-first, rules §2)

All fixtures validated by Zod schemas in `lib/schemas/mock.ts`; TS types via `z.infer` in `types/domain.ts`. Money values stay **strings** (PRD §D: never parse to float). Even though data is local, schemas keep the shape honest and ready for the real API.

- **Token**: `{ symbol: "nUSD", name: string, iconAccent: token }`
- **Pool / market** (Explore): `{ id, name, symbol, network: "Canton", status: "Active", contract: string, openBids: number, borrowIntents: number }`
- **Persona**: enum `"Lender" | "Borrower" | "Operator" | "Auditor" | "Outsider"`
- **LensRow** (per persona column): `{ persona, visibleCells: { label: string, visibility: "shared" | "only" | "hidden" }[] }` mapping the PRD B5 grid (green=shared, yellow=only, gray=hidden)
- **Verdict**: `"GREEN" | "RED"` with a reason string (RED = "operator skipped a cheaper lend")
- **ProfileSummary**: `{ address, network: "Canton", tier: "Bronze".."Platinum", repScore, collateralMultiplier, loansRepaid, defaulted, activeBorrows, activeLends, pendingIntents }`
- **Faq**: `{ question, answer }[]`

FAQ content (Nelva, from submission doc): What is Nelva? · How are rates discovered (sealed-bid)? · What is auditable matching (GREEN/RED)? · Can the operator see my bid? (honest caveat, PRD §8.1) · What are credit tiers and collateral? · Is Nelva safe? (caveats: shared key, mocked oracle, funds locked at bid).

## 6. Per-Screen Build Notes

**Home / Borrow (img 1):** title "Borrow privately on Nelva", subtitle on intents + collateral lock. Fields: amount (nUSD) with token select, collateral, max rate (%) default 6, duration (days) default 30. Encrypted-rate hint line ("Your max rate stays sealed until matching"). CTA "Submit Borrow Intent" (primary lavender, non-functional, shows a toast/disabled state).

**Home / Lend (img 2):** title "Lend privately on Nelva". Fields: amount, your rate (%) default 5, duration default 30. Sealed-rate hint. CTA "Submit Sealed Bid".

**Home / Lens (replaces img 3) — HERO:** 5 columns (Lender A / Borrower / Operator / Auditor / Outsider), each listing what that party may see with colored visibility dots (green/yellow/gray) + legend row. A verdict badge (GREEN by default) and a **"Cheat & Re-Audit"** button that flips the Auditor column verdict GREEN -> RED with a subtle 150-250ms animation (rules §7), and a reason line. Client component, local state only. This is the money shot; give it the most polish.

**Home / Status (img 4):** "Your Positions" with empty state card "No active intents or loans found." (toggle a fixture to show a sample row list of intents/loans for the populated state).

**FAQs section:** accordion under every Home tab, Nelva Q/A from §5.

**Explore (img 5):** hero card with title + subtitle (sealed and settled on Canton), 3 headline stats (Pools / Active Lend Intents / Active Borrow Intents), ghost art on the right. Featured pool cards with prev/next. Filter row (Token / Network / Status dropdowns + search). Pool table columns: # / Name / Open Bids / Borrow Intents / Network (Canton) / Contract. 2 mock markets.

**Profile (img 6):** header (avatar, address `0xebFA...4179`, Canton badge, Bronze tier badge, copy + explorer link, REP score, "2x Collateral" + progress to Silver). 5 stat tiles (Loans Repaid / Defaulted / Active Borrows / Active Lends / Pending Intents). Three cards: Active Positions (bar chart Lending/Borrowing/Intents), Credit History (empty "No loan history yet"), Private Wallet ("Fetch Balances" CTA that reveals mock balances on click). Bottom "Your Positions" empty state + FAQs.

## 7. Rendering & State (rules §8, §11)

- Pages are **Server Components** by default. `'use client'` pushed to leaves only: `TabSwitcher`/`HomeTabs`, `PersonaSwitcher`, `Accordion`, `LensPanel` (Cheat toggle), `PrivateWallet` (reveal). Everything else stays server-rendered.
- Routes are **static (SSG)** — content is identical for everyone this phase; no `force-dynamic`, no `searchParams` reads. (Tab/persona selection is client UI state, not URL state yet; revisit when it should be shareable.)
- No global store. Local `useState` for tab, persona, accordion, lens verdict, wallet reveal.

## 8. Rules Compliance Checklist (for build phase)

- [ ] No hex in JSX; all colors via tokens (§6).
- [ ] No comments in source; self-documenting names (§5).
- [ ] No em-dash anywhere in code/copy (§2). Use hyphen/colon.
- [ ] No `any`/`as`/`@ts-ignore`; mock data typed via Zod `z.infer` (§2).
- [ ] Feature parts go through page `index.tsx` public entry; no deep cross-imports (§3).
- [ ] Money values are strings (PRD §D).
- [ ] Empty states present (Status, Credit History, Positions) (§12).
- [ ] Semantic HTML: `<button>` for actions, `<nav>`, `<a>` for links, labeled inputs, visible focus (§7 a11y).
- [ ] Images via `next/image` (logo, ghost art); fonts via `next/font` (§10).
- [ ] Responsive mobile-first; tab switcher collapses, table scrolls on small screens (§7).
- [ ] `pnpm lint` (biome) + `tsc --noEmit` clean before done (§17).
- [ ] Read `node_modules/next/dist/docs/` for the pinned Next 16 conventions before writing route/layout code (per `frontend/AGENTS.md`).

## 9. Build Order

1. **Foundations**: update `globals.css` tokens, `layout.tsx` (Nelva metadata, dark theme, Navbar mount), `config/nav.ts`, `lib/schemas/mock.ts` + `types/domain.ts`.
2. **UI primitives**: Button, Card, Badge, StatTile, AmountField, TokenSelect, TabSwitcher, Accordion.
3. **Layout**: Navbar + PersonaSwitcher + WalletPill.
4. **Home**: index + HomeTabs + Borrow/Lend/Status panels + shared FaqSection. Then **Lens** panel (hero, most polish).
5. **Explore**: hero, featured pools, filters, table + fixtures.
6. **Profile**: header, stats, three cards, positions + fixtures.
7. **Pass**: responsive check, a11y/focus pass, lint + type-check, then review against §8.

## 10. Open Items / Deferred

- Real wallet connect, persona-gated data, backend gateway wiring (next phase).
- URL state for active tab/persona (when shareable links matter).
- Tests (Zod fixtures double as test fixtures later, §15).
- Second collateral token in Borrow selector — only if product confirms multi-instrument (PRD NICE).
```
