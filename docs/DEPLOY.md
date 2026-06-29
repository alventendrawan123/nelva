# Nelva — Deploy Guide (Railway + Vercel)

Live product = **FE on Vercel** → **BE+Canton on Railway** (one container). No database, no separate VM.

```
Vercel (FE, Next.js) ──HTTPS──▶ Railway (1 container)
                                  ├─ BE (Express)      :$PORT  (public)
                                  └─ Canton sandbox    :7575   (internal, localhost)
```

The BE is the only public surface; it reaches the Canton ledger over `localhost` inside the same container.

---

## 1. Backend → Railway

**Prereqs:** Railway account on a plan with **≥ 2 GB RAM** (the JVM Canton sandbox needs it; the free 512 MB tier is not enough). Repo pushed to GitHub.

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. Service **Settings → Root Directory = `be`** (Railway then auto-detects `be/Dockerfile` + `be/railway.json`).
3. **Variables** — these are already baked into the Dockerfile, override only if needed:
   - `LEDGER_MODE=canton`
   - `JSON_LEDGER_API=http://localhost:7575`
   - `NELVA_PACKAGE_ID=2ca7c73857de562d7a62f1550384a577c24fa1c5db614c4fd4028c7ddb1847fe`
   - (`PORT` is injected by Railway — do not set it.)
   - `FE_ORIGIN` — set **after** step 2 of Vercel (the Vercel URL), then redeploy. Locks CORS.
4. Deploy. First boot takes ~30–60 s (sandbox start + DAR vetting + seed); healthcheck `/api/health` has a 240 s grace.
5. Copy the public URL, e.g. `https://nelva-be.up.railway.app`. Verify: open `…/api/health` → `{"ok":true,"mode":"canton"}`.

## 2. Frontend → Vercel

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory = `frontend`** (framework auto-detected: Next.js).
3. **Environment Variable:** `NEXT_PUBLIC_API_BASE_URL = https://<your-railway-url>/api`
4. Deploy → this Vercel URL is the **live product link** for submission.

## 3. Lock CORS

Back on Railway, set `FE_ORIGIN = https://<your-vercel-url>` and redeploy the BE. (Multiple origins: comma-separate.)

## 4. Smoke test the live chain

1. `GET https://<railway>/api/health` → `{"ok":true,"mode":"canton"}`
2. Open the Vercel URL → switch persona **Operator** → run a match → switch **Auditor** → Verify (GREEN) → **Cheat Match** → Verify (RED).
3. Switch **Outsider** → confirm only public totals are visible (privacy holds).

---

## Notes (honest)

- **Ephemeral ledger.** The sandbox is in-memory; a Railway restart/redeploy resets it, and the BE **re-seeds on boot** (LenderA/LenderB 100, Borrower 300). Fine for a demo — data created during judging persists only until the next restart.
- **This is a real Canton ledger in sandbox mode** (single participant), not the shared public DevNet. Per-party privacy is real and verifiable. State this plainly in the submission.
- **Auth.** The persona switcher is an intentional demo affordance (judges experience all five perspectives). Production auth = OIDC/JWT inbound (the BE already has the OAuth2 client-credentials plumbing outbound). CORS + a basic rate limit blunt public abuse.
- **Upgrade path to true DevNet:** swap the ledger endpoint via env only (`JSON_LEDGER_API` + `AUTH_*`) — no code change — once a validator (self-host or NaaS) is available.
