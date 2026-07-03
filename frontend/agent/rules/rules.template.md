# Project Rules — Template

These rules are mandatory for all contributors (humans and AI agents) working in this repository. The goal is to maintain code quality, architectural consistency, and production readiness.

> Adapt project-specific details (tech stack versions, directory aliases, design tokens, library choices) to your project before adopting. The rules themselves are framework-agnostic where possible; sections tied to a specific framework note that assumption.

### Non-Negotiables

1. **Clean Architecture*


* — separation of concerns is strictly enforced (see section 3).
2. **No-comment policy** — code must be self-documenting (see section 5).
3. **Design tokens, never hex literals** — visual identity applied via tokens (see section 6).
4. **Production-ready** — every PR must pass the checklist in section 17.
5. **Type-safe by default** — no `any`/`as` escape hatches; external data (API JSON, third-party responses, storage reads) validated with a schema validator such as Zod (see section 2 → Type Safety).

---

## 1. Commit & Push Rules (Conventional Commits)

Every commit **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) standard. Commit messages must start with one of the following prefixes:

| Prefix      | Purpose                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `feat:`     | A new user-facing feature                                              |
| `fix:`      | A bug fix                                                              |
| `docs:`     | Documentation changes (README, public comments, JSDoc, etc.)           |
| `style:`    | Formatting, whitespace, semicolons — no logic change                   |
| `refactor:` | Code restructuring without behavior change                             |
| `perf:`     | Performance improvements                                               |
| `test:`     | Adding or fixing tests                                                 |
| `build:`    | Build system, dependencies, or lockfile changes                        |
| `ci:`       | CI/CD configuration changes                                            |
| `chore:`    | Maintenance tasks that don't fit other categories                      |
| `revert:`   | Reverting a previous commit                                            |

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Rules

- **Subject** is written in English, lowercase, imperative mood, no trailing period, max 72 characters.
- **Scope** is optional; use it to mark the affected module/feature (e.g. `feat(auth): add login form`).
- **Body** is optional; explain the **why**, not the **what**.
- **Breaking changes** must be marked with `BREAKING CHANGE:` in the footer or `!` after the type (e.g. `feat!: drop support for Node 18`).
- **Forbidden**: generic messages such as `update`, `fix bug`, `wip`, `asdf`.

### Push Rules

- **Forbidden** to force-push to `main` / `master` / `develop`.
- **Forbidden** to use `--no-verify` to skip hooks without maintainer approval.
- Use branch naming: `feat/<feature-name>`, `fix/<bug-name>`, `chore/<task>`.
- PRs must pass lint, type-check, and tests before merge.
- Squash-merge is the default for feature branches to keep `main` history clean.

### Secret Files — NEVER Push

- **Strictly forbidden** to commit or push files containing secrets, including but not limited to:
  - `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.*.local`
  - Private keys (`*.pem`, `*.key`, `id_rsa`, mnemonics, seed phrases)
  - Credentials files (`credentials.json`, `service-account.json`, `gcp-key.json`)
  - API tokens, OAuth secrets, GitHub tokens, database connection strings, signing keys
  - Keystores, deployer keys, RPC/service URLs containing API keys
- All of the above **must** be listed in `.gitignore` before any work begins.
- Use `.env.example` (committed) to document the required variables — never commit real values.
- Stage files explicitly by name (`git add path/to/file`); **avoid** `git add .` or `git add -A`, which can sweep in untracked secret files by accident.
- Before pushing, run `git diff --cached` and verify no `.env*`, key, or credential file is included.
- If a secret is accidentally committed: **rotate the secret immediately** (it must be considered compromised), purge it from history (`git filter-repo` / BFG), and force-push only after maintainer approval.
- Tools (humans and AI agents) loading a secret from `.env*` to perform a task **must** consume it inline (e.g. shell variable, redacted output) and never echo, log, or write it to any tracked file.

---

## 2. Clean Code Rules

All code **must** be clean, maintainable, and readable.

### Naming

- Use **descriptive** and **self-explanatory** names — avoid ambiguous abbreviations (`usr`, `tmp`, `data2`).
- `camelCase` for variables and functions, `PascalCase` for components and types, `SCREAMING_SNAKE_CASE` for global constants.
- Booleans start with `is`, `has`, `should`, `can` (e.g. `isLoading`, `hasError`).
- Component files: `PascalCase.tsx`. Util/hook files: `camelCase.ts` or `kebab-case.ts` per module convention.

### Functions

- One function = one responsibility (Single Responsibility).
- Max 30 lines per function. Beyond that, it **must** be split.
- Max 3 parameters. Beyond that, use an object parameter.
- Avoid nested ternaries and deep nesting (>3 levels) — prefer early returns / guard clauses.

### Readability

- **NEVER use the em-dash character (`—`).** Forbidden everywhere: code, strings, JSX/UI copy, comments, docs, commit messages, and PR text. Use a hyphen (`-`), a colon (`:`), parentheses, or rewrite the sentence. This is a hard review blocker; a single `—` fails the check.
- **No comments in code** (see section 5).
- Code must be self-documenting through clear naming.
- Avoid magic numbers / magic strings — extract them into named constants.
- Stay consistent with the existing codebase style. Respect the Biome / ESLint / Prettier config.

### Maintainability

- DRY (Don't Repeat Yourself), but don't over-abstract. Three occurrences is the refactor threshold.
- KISS (Keep It Simple, Stupid). The simplest solution that solves the problem always wins.
- YAGNI (You Aren't Gonna Need It). Don't write code for hypothetical needs.
- Write tests for non-trivial logic (unit tests for utils, integration tests for important flows).

### Type Safety (TypeScript)

When facing a type error, **fix the type — never silence the checker.** These rules are mandatory:

1. **No escape hatches.** `as any`, `as unknown as`, `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error` are **forbidden**. If you reach for one, you have not solved the problem.
2. **Define the shape.** When a value's shape is unclear or untyped, declare an explicit `interface` / `type` (or a Zod schema, see rule 5) instead of leaving it loose.
3. **Narrow at runtime.** Use type guards or narrowing (`typeof`, `instanceof`, `in`, discriminated unions, custom `value is T` predicates) for runtime checks — never assert a shape you haven't verified.
4. **Prefer `satisfies` over `as`.** To validate a value against a type while keeping its inferred type, use `value satisfies T`, not `value as T` — `as` suppresses excess/missing-property checks, `satisfies` enforces them.
5. **Validate external data with Zod.** Any data crossing a trust boundary — `fetch`/API JSON, `response.json()`, `localStorage`/`sessionStorage`, `postMessage`, env vars, third-party SDK responses — **must** be parsed with Zod (`safeParse` + graceful fallback on read paths) before use. Derive the TS type with `z.infer` so the schema is the single source of truth.
6. **Explain your choice.** In the PR (or commit body), state which type/guard/schema you used and **why** — especially for non-obvious narrowing or a deliberately lenient schema.

> Reuse shared schemas and type-guards before writing new ones. Keep reusable schemas in a central location (e.g. `src/lib/schemas/`).

---

## 3. Architecture Rules (Clean Architecture)

The project architecture must be **clean**, **modular**, and follow Clean Architecture principles.

### Layering

```
src/
├── app/                  # App routing (pages, layouts, route handlers)
├── features/             # Feature modules (domain-driven)
│   └── <feature>/
│       ├── components/   # UI components owned by this feature
│       ├── hooks/        # React hooks
│       ├── services/     # API calls / data access
│       ├── stores/       # State management
│       ├── types/        # Types & interfaces
│       └── utils/        # Pure helpers
├── components/           # Shared UI components (design system)
│   └── ui/               # Primitives (Button, Input, Card, ...)
├── lib/                  # Shared library (api client, fetcher, etc.)
├── hooks/                # Shared hooks
├── utils/                # Shared pure utils
├── types/                # Shared types & interfaces
├── config/               # Configuration (env, theme, routes)
└── styles/               # Global styles
```

### Dependency Rule

- **Domain / business logic** must not depend on **UI** or **framework**.
- **UI layer** may depend on **business logic**, never the other way around.
- **Outer layers** (UI, infrastructure) depend on **inner layers** (domain), never the reverse.
- **Circular dependencies** between modules are forbidden.

### Separation of Concerns

- Components **only** handle presentation. Complex logic is lifted into custom hooks or services.
- Services **only** handle communication with APIs / external systems.
- Stores **only** handle state management.
- Utils **only** contain pure functions with no side effects.

### Modularity

- New features are built as modules in `src/features/<feature>/`.
- Direct imports of internal files from another feature are forbidden — go through that feature's `index.ts` (public API).
- Shared code used by more than 2 features is moved to `src/components`, `src/hooks`, or `src/utils`.

---

## 4. Clean Files Rules

- **Forbidden** to keep unused files (dead code, backup files, `*.old.tsx`).
- **Forbidden** to commit `console.log`, `debugger`, or commented-out code.
- **Forbidden** to commit credentials, API keys, or any secrets.
- `.env`, `.env.local`, etc. **must** be in `.gitignore`.
- Each file has **one** responsibility. If a file exceeds 300 lines, evaluate whether to split it.
- Import order: external libraries → internal aliases (`@/...`) → relative paths → styles.
- Remove unused imports (auto-fixed via Biome / ESLint).

---

## 5. No Comment Rule

**No comments are allowed in source code.** Code must be self-explanatory through clear naming and structure.

### Exceptions (allowed)

- JSDoc / TSDoc on **public APIs** (exported functions/components consumed by other modules).
- Comments explaining the **WHY** behind a non-obvious workaround (browser bug, hardware constraint, etc.). Include an issue/PR link when available.
- TODO/FIXME entries that **must** include an owner and a tracker link (`// TODO(@owner): [TICKET-123] handle retry`).
- License headers required by legal obligation.

### Forbidden

- Comments explaining the **WHAT** — the code already does that.
- Comments referring to a task/PR/sprint (`// added for sprint 12`).
- Commented-out code — use version control for history.
- Decorative comments (`// ===== UTILS =====`).

---

## 6. Design Pattern: Design Tokens

The project's visual identity **must** be applied through design tokens, never hardcoded values.

### Palette

- Define the palette once (theme tokens / CSS variables) and consume via utility classes or token references.
- No hex literals inside components.
- Establish clear roles: background, surface/card, primary text, secondary text, primary action (CTA), secondary action, active state.

### Usage Rules

- A base palette dominates; accents are reserved for primary actions and emphasis.
- Surfaces follow a consistent treatment (elevation, borders, blur) defined by tokens.
- Semantic accents (success, warning, error) are allowed for feedback while the base palette stays consistent.
- Contrast must meet WCAG AA (ratio at least 4.5:1 for body text).

### Implementation

- Use utility classes and CSS variables. No hardcoded hex values in JSX.
- Brand tokens are defined once (e.g. `globals.css` `@theme`) and consumed via classes.

---

## 7. UI/UX Rules: Minimalist & Clean

The design **must** be minimalist, clean, and production ready.

### Principles

- **Less is more.** Remove any element without a clear purpose.
- **Clear hierarchy** — users know where to look first.
- **Generous whitespace** — never crowd elements without reason.
- **Consistency** — the same component behaves and looks the same throughout the app.
- **Typography**: max 2 font families, max 5 font sizes per screen.
- **Iconography**: use a single icon set (Lucide / Heroicons) with consistent sizes.

### Layout

- Use a consistent 12-column grid / flexbox.
- Spacing follows a 4px scale (4, 8, 12, 16, 24, 32, 48, 64).
- Border radius is consistent — define `sm`, `md`, `lg`, `full` tokens.
- Soft shadows, never excessive. Max 3 elevation levels.

### Interaction

- **Feedback**: every user action must have feedback (loading, success, error).
- **Loading state**: skeleton > spinner. Avoid blocking the UI.
- **Empty state**: explain the situation and provide a CTA when relevant.
- **Error state**: clear, actionable, human messages (never raw stack traces).
- **Animation**: subtle, 150–250ms duration, `ease-out` easing. Respect `prefers-reduced-motion`.

### Accessibility (a11y)

- Semantic HTML (`<button>` for actions, `<a>` for navigation).
- Every input has a `<label>`.
- Focus states **must** be visible.
- Keyboard navigable — every action reachable via Tab.
- Meaningful alt text for images; `alt=""` for decorative ones.
- ARIA only when semantic HTML isn't enough.

### Responsive

- **Mobile-first.** Design for the smallest screen first, then scale up.
- Breakpoints follow Tailwind defaults: `sm`, `md`, `lg`, `xl`, `2xl`.
- Touch targets are at least 44×44 px.

---

## 8. Rendering Strategy Rules

> Assumes a Next.js App Router (or similar SSR/SSG-capable) framework.

Every route **must** make a deliberate rendering decision. "It rendered" is not a decision — picking the cheapest strategy that still meets the UX requirement is.

### Decide Per Route

| Strategy            | Use when                                                              | Cost profile                          |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| **Static (SSG)**    | Content is the same for everyone and rarely changes (marketing, docs) | Cheapest, fastest TTFB, served from CDN |
| **ISR** (`revalidate`) | Mostly static but needs periodic freshness (listings, catalogs)    | Cheap, near-static, self-updating      |
| **SSR (dynamic)**   | Per-request / personalized / auth-gated data                          | Most expensive — justify it            |
| **Streaming** (Suspense) | A page mixes fast and slow data; ship the shell first           | Best perceived performance for slow data |

A route that is `force-dynamic` **must** have a documented reason in the PR. Accidental dynamic rendering (caused by reading `cookies()`, `headers()`, or `searchParams` without need) is treated as a performance bug.

### Server Components Are the Default

- Components are **Server Components by default**. `'use client'` is an opt-in, not a habit.
- Push `'use client'` to the **leaves** of the tree (the interactive widget), never the page or layout. Wrapping a whole page in `'use client'` ships the entire subtree to the browser and is **forbidden** without justification.
- Data fetching, secrets, and heavy dependencies belong in Server Components. The client only gets what it needs to be interactive.
- Pass server data **down as props / RSC payload**; do not re-fetch on the client what the server already has.

### Streaming & Suspense

- Wrap slow data regions in `<Suspense>` with a meaningful skeleton fallback (skeleton > spinner, per §7).
- Never let one slow query block the whole page. Co-locate the `<Suspense>` boundary with the slow component so the rest of the page streams immediately.

---

## 9. Data Fetching & Caching Rules

Caching is the single highest-leverage performance lever and the most common source of "stale data" bugs. **Caching is a deliberate decision at every fetch — never an accident, never a copy-paste.**

### Know the Four Caching Layers (Next.js App Router)

You **must** be able to name which layer you are relying on for any given data:

1. **Request Memoization** — dedupes identical `fetch` calls within a *single* render pass. Free, automatic, in-memory, per-request.
2. **Data Cache** — persists fetch/data results **across requests and deployments** on the server. Controlled per-fetch via `cache` and `next: { revalidate, tags }`.
3. **Full Route Cache** — the built/rendered RSC payload + HTML of a static route, served without re-rendering.
4. **Router Cache (client)** — the RSC payload cached **in the browser** for instant back/forward and prefetch navigations.

> **Version warning (junior trap):** Next.js caching **defaults changed between major versions** (notably 14 → 15 — `fetch` is no longer cached by default, and the client Router Cache `staleTime` defaults differ). **Never rely on a remembered default.** Confirm the actual behavior for the version pinned in `package.json` before assuming data is or isn't cached.

### Caching Rules

- **Be explicit.** State the caching intent at the call site: `cache: 'force-cache'` (static), `cache: 'no-store'` (always fresh), or time-based `next: { revalidate: N }`. An un-annotated fetch on a critical path is a review blocker.
- **Tag everything cacheable.** Attach `next: { tags: ['...'] }` so it can be invalidated surgically.
- **Invalidate on mutation, don't guess on time.** After a write (Server Action / route handler that changes data), call `revalidateTag()` / `revalidatePath()`. Prefer **on-demand invalidation** over short `revalidate` windows that hammer the origin.
- **Validate cached & fetched data with Zod** (per §2 → Type Safety rule 5). Data read from any cache layer still crosses a trust boundary — `safeParse` it with a graceful fallback before use.
- **Cache the slow and stable, never the personal.** Per-user / auth-sensitive responses **must not** land in a shared cache. Be deliberate about cache keys to avoid cross-user leakage.

### Client-Side Server State (stale-while-revalidate)

For data fetched on the client (interactivity, polling, infinite scroll, optimistic mutations), use a dedicated server-state library (**TanStack Query** or **SWR**). This is **not optional plumbing** — it is the standard:

- **Stale-while-revalidate**: render cached data instantly, refetch in the background.
- **Request deduplication**: the same key in flight twice = one request.
- **Explicit cache invalidation** on mutation (`invalidateQueries` / `mutate`).
- **Optimistic updates** with rollback on failure for write-heavy UX.
- **Forbidden:** raw `useEffect(() => fetch())` for server data in a client component when a server-state library is available. It re-fetches on every mount, has no dedup, no cache, and no error/retry story.

### HTTP & CDN Caching (Static Assets)

- Hashed, content-addressed assets (`app.[hash].js`) **must** be served with `Cache-Control: public, max-age=31536000, immutable`. The hash is the cache-buster.
- HTML / dynamic responses use short or `no-store` policies with `ETag` revalidation as appropriate.
- Assets are served from the **CDN edge**, not the origin. Do not defeat this by proxying static assets through dynamic routes.

---

## 10. Performance Budget & Asset Optimization Rules

Performance is a **budget**, not a hope. What isn't measured and capped will regress silently, one PR at a time.

### JavaScript Budget

- **Code-split by route** and lazy-load heavy, below-the-fold, or rarely-used client components via `next/dynamic` (`{ ssr: false }` when it's purely client).
- **Tree-shake aggressively.** Import the member, not the barrel: `import debounce from 'lodash/debounce'`, never `import _ from 'lodash'`. Beware libraries that aren't tree-shakeable.
- **Audit the bundle** before merging anything that adds a dependency. A new dependency over a few KB **must** be justified in the PR ("why not a smaller / native option?").
- **Set a per-route JS budget** in CI. A PR that blows the budget fails until justified or fixed.

### Images & Fonts

- **Images:** use `next/image`. Modern formats (AVIF/WebP), correct `sizes`/`srcset`, explicit dimensions to prevent layout shift, and lazy loading by default. Mark the LCP image `priority`.
- **Fonts:** use `next/font` (self-hosted, no layout shift, no extra round-trip). `font-display: swap`, preload only critical weights, subset where possible.

### Network Behavior

- **Avoid request waterfalls.** Fetch in parallel (`Promise.all`, parallel Suspense) instead of awaiting requests in series when they don't depend on each other.
- Use `preconnect` / `preload` for known-critical origins and resources; rely on the route `prefetch` for likely navigations.
- **Debounce / throttle** high-frequency handlers (search input, scroll, resize).

### Runtime Rendering Performance

- **Eliminate unnecessary re-renders** — the most common cause of jank in mature React apps. Reach for `memo` / `useMemo` / `useCallback` **with a measured reason**, not reflexively (premature memoization is its own smell — §2 YAGNI).
- **Virtualize long lists** (`@tanstack/virtual` or equivalent) — never render thousands of DOM nodes at once.

### The Targets (binding)

Core Web Vitals on all primary pages: **LCP < 2.5s · CLS < 0.1 · INP < 200ms**. Note: **INP replaced FID** — INP measures responsiveness across the whole session, so heavy event handlers and long tasks are now first-class performance bugs.

---

## 11. State Management Discipline

Mixing the wrong state in the wrong place is one of the most common architectural bugs juniors ship. The categories are not interchangeable.

- **Server state** (data owned by the backend) — managed by the data layer / server-state library (§9). It is **forbidden** to copy server data into a global client store (Redux/Zustand/Context) and hand-sync it. The cache *is* the source of truth.
- **Client state** (UI-only: modal open, active tab, form draft, wizard step) — local `useState`/`useReducer`, lifted only as far as needed, or a small per-feature store when genuinely shared.
- **URL state** (filters, pagination, tabs that should be shareable/bookmarkable) — lives in the URL (`searchParams`), not in memory. Survives refresh and is linkable.
- **Form state** — a dedicated form library for non-trivial forms; validate with the same Zod schema used at the API boundary (single source of truth, §2).

**Prop drilling beyond ~3 levels** is a signal to use composition or context — never a reason to reach for global state by default (§3 separation of concerns).

---

## 12. Resilience & Error Handling Rules

The question is never "does it work?" — it is **"what does the screen show when the API is slow, errors, returns empty, or returns garbage?"** Every async surface **must** answer all four.

- **Every data fetch handles four states: `loading`, `error`, `empty`, `success`.** Shipping only the happy path is a review blocker. A blank white screen on failure is the signature of unfinished work.
- **Error boundaries:** use route-level `error.tsx` (and `global-error.tsx` for the root) plus React Error Boundaries around risky client subtrees. A render error in one widget must not white-screen the whole app.
- **`not-found.tsx`** for missing resources; never a generic crash.
- **Retries & timeouts:** network calls have a timeout and, where safe (idempotent reads), a bounded retry with backoff. Don't retry non-idempotent writes blindly.
- **Human error messages** (§7): actionable, plain language, never a raw stack trace or raw error code in the UI.
- **Fail safe, not silent.** A swallowed error (`catch {}` with nothing) is forbidden — surface it to the user *and* report it (§14).

---

## 13. Runtime Security Rules

§1 already forbids committing secrets. This section covers the **runtime** attack surface — what ships to and runs in the user's browser.

- **XSS:** treat all rendered user/remote content as hostile. `dangerouslySetInnerHTML` is **forbidden** without sanitization (e.g. DOMPurify) and a documented WHY (§5). Prefer rendering as text.
- **No secrets in the client bundle.** Only `NEXT_PUBLIC_`-prefixed env vars reach the browser — so **never** put a secret behind that prefix. Server-only secrets stay in Server Components / route handlers / Server Actions.
- **Token storage:** understand the trade-off and document the choice. Prefer `httpOnly`, `Secure`, `SameSite` cookies for auth tokens over `localStorage` (which is readable by any XSS).
- **Security headers / CSP:** ship a Content-Security-Policy (nonce-based for the App Router) and standard hardening headers (`X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, frame protections) via `next.config` `headers()` or middleware.
- **Dependency hygiene:** `pnpm audit` in CI; no installing unvetted/random packages (§1). Pin and review lockfile changes.
- **Validate at every trust boundary with Zod** (§2 rule 5) — API JSON, `postMessage`, `localStorage`, third-party SDK responses. Untrusted shape = parsed shape, always.
- **Server Actions / route handlers** validate and authorize **on the server**. Client-side checks are UX, never a security control.

---

## 14. Observability & Monitoring Rules

If you only learn about bugs when a user complains, you are already late. Shipped code **must** be observable.

- **Error tracking:** integrate an error monitor (e.g. Sentry) capturing client *and* server errors with source maps, release tagging, and enough context (route, user-anonymized id) to reproduce. Every caught-and-surfaced error (§12) is also **reported**, never just swallowed.
- **Real User Monitoring (RUM):** report **Core Web Vitals from real users**, not just Lighthouse lab runs. Use `useReportWebVitals` (App Router) to stream LCP/CLS/INP to analytics. Lab numbers approve a PR; field numbers tell the truth.
- **Structured logging** on the server side — consistent, queryable, **never** logging secrets or PII.
- **Alerting:** error-rate and Web-Vitals regressions should page someone, or at minimum surface on a dashboard the team actually watches.

---

## 15. Testing Strategy Rules

Coverage percentage is a vanity metric. **Tests must catch real bugs, not lock in implementation details.**

- **Shape (testing pyramid):** many fast **unit tests** for logic/utils/hooks → fewer **integration tests** for important flows → a few **E2E tests** (Playwright) for critical journeys only (login, checkout, the money path).
- **Test behavior, not internals.** Assert what the user sees and can do (Testing Library philosophy). A test that breaks on a harmless refactor is a liability, not an asset.
- **Mock the network at the boundary** (e.g. MSW) instead of stubbing `fetch` ad hoc — tests then exercise real request/response handling.
- **Reuse Zod schemas** to build realistic fixtures so test data matches production shape.
- **Accessibility in tests:** include automated a11y checks (e.g. `axe`) on key components; semantic queries (`getByRole`) double as a11y assertions.
- Per §2: write tests for **non-trivial** logic. Don't test the framework or trivial getters.

---

## 16. SEO, Metadata & Discoverability Rules

For a design-led, production-ready public web app, discoverability and link presentation are part of "done."

- **Metadata** is defined via the App Router Metadata API (`metadata` export / `generateMetadata`) — title, description, canonical, **Open Graph** and **Twitter** cards for every public route. Dynamic routes generate metadata from their data.
- **Structured data** (JSON-LD) where it adds value (articles, products, breadcrumbs).
- **`sitemap.ts`** and **`robots.ts`** are maintained; public routes are crawlable, private ones are not.
- **Semantic HTML** (already required in §7) does double duty: accessibility *and* SEO. One landmark `<h1>` per page, meaningful heading order.
- **Don't ship secret/auth content to crawlers**, and don't index staging/preview deployments.

---

## 17. Production Ready Checklist

Before merging into `main`, all the following items **must** be satisfied:

- [ ] `pnpm lint` — passes with no errors/warnings.
- [ ] `pnpm type-check` (or `tsc --noEmit`) — passes with no errors.
- [ ] `pnpm test` — all tests green.
- [ ] `pnpm build` — build succeeds with no warnings.
- [ ] No `console.log`, `debugger`, or unowned `TODO`s.
- [ ] No secrets / credentials committed.
- [ ] Environment variables documented in `.env.example`.
- [ ] Loading, empty, and error states handled.
- [ ] Tested on mobile, tablet, and desktop.
- [ ] Performance check (Lighthouse / Web Vitals) — LCP <2.5s, CLS <0.1, INP <200ms.
- [ ] Accessibility check — keyboard navigable, contrast OK, screen reader OK.
- [ ] Clear PR description: **what** & **why**, linked issue, screenshot/video for UI changes.
- [ ] **Rendering strategy** is deliberate; any `force-dynamic` is justified in the PR.
- [ ] **Caching intent is explicit** at every fetch; cacheable data is **tagged** and invalidated on mutation.
- [ ] **Server state is not duplicated** into a global client store.
- [ ] **Bundle budget** respected; new/heavy dependencies justified; route JS within budget.
- [ ] Images via `next/image`, fonts via `next/font`; **no layout shift** from media.
- [ ] **All four data states** (loading / error / empty / success) handled; `error.tsx` / `not-found.tsx` in place.
- [ ] **No secrets** behind `NEXT_PUBLIC_`; CSP + security headers configured.
- [ ] **External data validated with Zod** at every trust boundary.
- [ ] **Error tracking + RUM Web Vitals** wired up for this feature.
- [ ] **Metadata / OG tags** present for public routes; sitemap/robots updated if routes changed.

---

## 18. Enforcement

- These rules are enforced through: **Biome / ESLint**, **TypeScript strict mode**, **commitlint**, **husky pre-commit**, and **CI pipeline**.
- Repeated violations → PR will be blocked.
- Rule updates must go through a PR to this file, with discussion in review.

> Rules exist to help, not to obstruct. If any rule blocks productivity without delivering value, propose a revision via PR.
