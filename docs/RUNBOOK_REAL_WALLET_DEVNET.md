# Nelva — Real CIP-0103 Wallet on DevNet: Turnkey Runbook

**Goal:** take Nelva from *embedded-wallet-on-a-sandbox* to *a REAL CIP-0103 Canton wallet that a judge can use in-browser, with no node of their own*.

**Audience:** Alven (dev) + a coding agent executing the phases in order.

**Source of truth:** verified research findings + adversarial verdicts compiled 2026-06/07. Where a fact is environment-dependent or unconfirmed, it is marked **[UNKNOWN — verify live]**. Commands without a cited source are marked **[NO SOURCE — do not run blind]**.

**Repo facts already verified (this runbook is wired to them):**
- FE adapter already exists: `D:\nelva\frontend\src\lib\wallet\canton.ts` — registers a `RemoteAdapter` from `CANTON_GATEWAY_URL`, opens the Discovery picker via `connect()`, submits via `prepareExecuteAndWait`. Gated by `NEXT_PUBLIC_CANTON_GATEWAY_URL` (empty = dormant, embedded wallet only). See `D:\nelva\frontend\src\config\env.ts`.
- FE dep present: `@canton-network/dapp-sdk ^1.3.0` (`D:\nelva\frontend\package.json`).
- DAR built: `D:\nelva\be\nelva-sc-0.1.0.dar` (~765 KB).
- BE relay + dev auth: `D:\nelva\be\src\server.ts` — `who()`/`requireParty`/`requireRole` trust **Bearer = party name** (flagged at server.ts:45-48 as the gap to close), plus `/api/wallet/onboard`, `/api/wallet/allocate`, `/api/wallet/prepare`, `/api/wallet/execute` (interactive submission relay).

---

## 1. TL;DR — Feasibility verdict

**Can a judge use a REAL Canton wallet with NO node of their own? → YES (capability confirmed).** But the *make-it-real-on-a-shared-network* gate is operational, not technical, and it is measured in **days**.

| Claim | Verdict | What it means for us |
|---|---|---|
| Judge with no local node can use a real CIP-0103 wallet by connecting in-browser to a Wallet Gateway **we** host next to our validator | **CONFIRMED** | The architecture is exactly the documented intended use of the *remote* Wallet Gateway + dApp SDK. `canton.ts` already speaks this. |
| Wallet Gateway runs in **self-custody / dev mode** (gateway holds Ed25519 keys) with **no paid custody provider** (no Fireblocks/DFNS) | **CONFIRMED** | `core-signing-internal` (`wallet-kernel`) driver is always registered; external custody registers only if its env vars are set. Free path for the demo. |
| **Splice LocalNet / cn-quickstart** can prove the full `dapp-sdk` connect+submit flow end-to-end **with no external SV sponsor** | **CONFIRMED** | Phase A is real and unblocked today. LocalNet bundles its own SV. Do this first. |
| A self-hosted validator joining **DevNet** requires **SV sponsorship + IP allowlist**, taking **2–7 days** (not minutes) | **CONFIRMED** | This is the long pole. Start the IP-allowlist request *now*, before anything else, or use an organizer-provided validator. |

**Important nuance on "real wallet":** the judge uses the wallet *we host* (keys custodied server-side in our gateway's `signingStore`, via the internal Ed25519 driver), not a personal pre-existing wallet. It is still a genuine CIP-0103 wallet and a genuine no-node-for-the-judge flow. The in-browser **extension** gateway (keys in the judge's browser) is **`[NOT IMPLEMENTED YET]`** upstream — do not promise it.

**Recommended plan of record:**
1. **Phase A now** (LocalNet) — proves the entire real-wallet flow on one laptop, zero external deps. This de-risks Phases C/D before the DevNet wait clears.
2. **Phase B in parallel, started day 0** — fire the SV-sponsor IP-allowlist request immediately because of the 2–7 day wait. **First, ask the organizers whether they provide a shared/pre-onboarded validator** — if yes, skip self-hosting.
3. **Phases C→E** layer the hosted gateway, FE flip, and prod auth on top.

**Fallback (always available):** if DevNet onboarding does not clear in time, the **embedded wallet stays**. `CANTON_GATEWAY_URL` unset → `canton.ts` is dormant and the app runs on the embedded wallet + BE relay exactly as it does today on the sandbox. No code is lost; the real-wallet path is purely additive and env-gated.

---

## 2. Architecture (ASCII)

```
                         JUDGE'S BROWSER (no node)
   ┌───────────────────────────────────────────────────────────────┐
   │  Nelva FE (Next.js)                                            │
   │   ├─ embedded path  ── BE relay (/api/wallet/prepare|execute)  │  ← today / fallback
   │   └─ real path: canton.ts                                      │
   │        @canton-network/dapp-sdk  (RemoteAdapter, rpcUrl)       │
   │        connect() → Discovery picker → prepareExecuteAndWait()  │
   └───────────────┬───────────────────────────────────────────────┘
                   │  CIP-0103 dApp API over HTTP/SSE
                   │  rpcUrl = https://<gateway-host>/api/v0/dapp
                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  WALLET GATEWAY  (splice-wallet-kernel, server-side)          │   WE HOST THIS
   │   :3030  /  (User UI)  /api/v0/dapp  /api/v0/user             │
   │   signing driver = wallet-kernel (Ed25519, keys in DB)        │   ← self-custody dev mode
   │   IDP = self_signed (dev)  |  OIDC/Keycloak (prod, Phase E)   │
   │   store/signingStore = SQLite-on-volume or Postgres          │
   └───────────────┬───────────────────────────────────────────────┘
                   │  JSON / gRPC Ledger API  (+ JWT injected by gateway)
                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  CANTON VALIDATOR / PARTICIPANT                               │   WE HOST THIS
   │   Nelva DAR uploaded (POST /v2/packages)                      │
   │   parties allocated   (POST /v2/parties)                     │
   │   Phase A: LocalNet (bundled SV, localhost)                  │
   │   Phase B: DevNet validator (SV-sponsored, IP-allowlisted)   │
   └───────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
        DevNet Global Synchronizer  (Phase B only; LocalNet has its own local synchronizer)
```

Writes that need a *user's* authority go through **interactive submission**: gateway/BE calls `prepare` (needs only `readAs`), the wallet signs the transaction hash with the party's key, then `execute` carries `party_signatures`. The participant operator never holds the user's key.

---

## 3. Phase A — Prove it locally (LocalNet rig)

**Outcome:** `connect → listAccounts → prepareExecuteAndWait(create/exercise)` against a real CIP-0103 Wallet Gateway, all on one laptop, zero external deps. **Do this before the DevNet wait clears.**

### Prereqs
- Docker Desktop, **≥ 12–16 GB** allocated to the VM (8 GB is the documented LocalNet minimum; we also run the gateway + its Postgres). On Windows: set this in `.wslconfig` and run inside **WSL2**.
- Node.js 20+ (gateway tested on Node 24), Yarn 4 via Corepack, `dpm` (Daml SDK). Use `dpm`, **not** the deprecated `daml-assistant` (Canton 3.4+).

### A.1 — Easiest full-stack path (kernel repo bundles LocalNet + mock OAuth)
```bash
git clone https://github.com/hyperledger-labs/splice-wallet-kernel
cd splice-wallet-kernel
yarn install && yarn build:all
yarn start:localnet     # brings up Splice LocalNet (bundled SV, no external sponsor)
yarn start:all          # Wallet Gateway + mock-oauth2 + example dApps (pm2)
yarn pm2 list           # health
# Gateway: User UI http://localhost:3030 | dApp JSON-RPC http://localhost:3030/api/v0/dapp
# Teardown: yarn stop:all ; yarn stop:localnet
```

### A.2 — Fastest proof of the SDK flow: the `ping` example
Run `examples/ping` (minimal React+Vite dApp: connect → listAccounts → query → create/exercise). It is the reference wiring for Nelva. Default gateway `http://localhost:3030`, app at `http://localhost:8080`. Reproduce its wiring, swap in Nelva's `templateId`s, done.

### A.3 — Alternative baseline: cn-quickstart LocalNet (if you want the validator stack separately)
```bash
git clone https://github.com/digital-asset/cn-quickstart
cd cn-quickstart && direnv allow && cd quickstart
make install-daml-sdk
make setup     # choose "Standard" profile (validators + synchronizer + PQS + JSON API + Keycloak)
make build
make start
make status    # health   |   make stop / make clean-all to tear down
```
Ports (per validator: 2=app-user, 3=app-provider, 4=sv): JSON Ledger API **2975 / 3975 / 4975**; gRPC **2901/3901/4901**; Admin **2902/3902/4902**; Postgres 5432; Keycloak 8082. UIs: wallet `:2000/:3000`, scan/sv `:4000`. *(cn-quickstart's bundled wallet UI is the legacy Splice amulet wallet, NOT a CIP-0103 endpoint — you still point the gateway at its Ledger API to get the dapp-sdk flow.)*

### A.4 — Upload the Nelva DAR + allocate parties (JSON Ledger API)
```bash
# Get a LocalNet token (Keycloak; Standard/Full profiles). Minimal profile is auth-disabled.
ADMIN_TOKEN=$(curl -fsS "http://keycloak.localhost:8082/realms/AppUser/protocol/openid-connect/token" \
  -d client_id=app-user-validator -d client_secret=6m12QyyGl81d9nABWQXMycZdXho6ejEX \
  -d grant_type=client_credentials -d scope=openid | jq -r .access_token)

# Upload the already-built DAR (returns {} on success)
curl -X POST "http://localhost:2975/v2/packages?vetAllPackages=true" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-binary @D:/nelva/be/nelva-sc-0.1.0.dar

dpm damlc inspect-dar D:/nelva/be/nelva-sc-0.1.0.dar   # get package id for templateIds

# Allocate a party (response: {"partyDetails":{"party":"Hint::1220...",...}})
curl -d '{"partyIdHint":"NelvaOperator","identityProviderId":""}' \
  -H "Content-Type: application/json" \
  -X POST http://localhost:2975/v2/parties
```

### A.5 — Point the FE at the local gateway (no code change, just env)
`canton.ts` already reads `NEXT_PUBLIC_CANTON_GATEWAY_URL`. In `D:\nelva\frontend\.env.local`:
```
NEXT_PUBLIC_CANTON_GATEWAY_URL=http://localhost:3030/api/v0/dapp
```
Click "connect" → Discovery picker → pick the gateway → `listAccounts()` → submit a Nelva create/exercise via `submitViaCantonWallet`.

### Gotchas (Phase A)
- **Endpoint-path skew:** the dapp-sdk README sometimes shows `/api/json-rpc`; the installed `gateways.json` default and the gateway README use **`/api/v0/dapp`**. **Verify the literal path your pinned gateway version serves** before hardcoding, or `connect()` fails silently. Our `env.ts` default is empty, so set it explicitly.
- LocalNet's bundled wallet UI is **not** CIP-0103 — the dapp-sdk cannot talk to the Ledger API as if it were a wallet. You **must** run the separate Wallet Gateway. (This is exactly why `canton.ts` uses `RemoteAdapter`, not a direct ledger URL.)
- Canton Coin mining rounds take **~1 hour** to show in Scan — an empty Scan early is not a failure.
- Gateway needs its **own** Postgres with **store and signingStore in different databases** (`start:all` wires this; standalone runs do not).
- Resource reality: LocalNet Full + gateway + Postgres realistically wants **16 GB** to Docker/WSL2.

### Confidence: **HIGH.** Phase A is unblocked today and fully sourced.
### Open questions (Phase A)
- Confirm the dApp JSON-RPC path of the **pinned** gateway version (`/api/v0/dapp` vs `/api/json-rpc`) and that dapp-sdk **1.3.0** is wire-compatible with that gateway release.
- Does the Nelva DAR's `Holding`/`Loan` templates round-trip through the gateway's signing+submit proxy with **no Splice/amulet dependency**? (The external-signing spike proved plain creates work on a bare participant; confirm it also works *through the gateway proxy*.)
- Does the gateway's internal Ed25519 driver let us reuse the exact external-party signing recipe already proven, or does the gateway manage its own party allocation? Determines how much of the BE relay we keep vs delegate.

---

## 4. Phase B — DevNet validator onboarding (the long pole)

**Outcome:** a self-hosted Canton validator on DevNet, with the Nelva DAR uploaded and parties allocated, reachable by our hosted gateway. **The IP-allowlist adoption is 2–7 days — start STEP 1 on day 0.**

### B.0 — Decide self-host vs. fast path (do this first)
Before investing in self-hosting, **ask the hackathon organizers / GSF (Slack `#gsf-global-synchronizer-appdev`)** whether a **shared / pre-onboarded validator** is provided. Fast paths, in preference order:
1. Organizer/SV-sponsored or pre-onboarded validator (best — skips the wait entirely). **[UNKNOWN — confirm with organizers]**
2. Node-as-a-Service / shared validator (e.g. Dfns "Shared") — third-party.
3. Self-host on DevNet (below) — only if a sponsoring SV is lined up early.

### B.1 — SV sponsorship + IP allowlist (START NOW)
- Pick a sponsoring Super Validator. On DevNet there is **no Tokenomics-Committee vote**, but the validator's **egress IP must be added to the allowlist** by an SV.
- Reserve **ONE fixed/static egress IP** (NAT gateway), distinct from your IPs on the other two networks.
- Give that IP to the sponsor and ask them to submit it for the DevNet allowlist.
```bash
curl -sSL http://checkip.amazonaws.com   # confirm your node's real egress IP == the one you gave the sponsor
```

### B.2 — Wait for allowlist adoption (2–7 days)
You **cannot** onboard until egress traffic exits via the allowlisted IP. This is the gating wait — Phase A keeps you productive meanwhile.

### B.3 — Self-generate the onboarding secret (DevNet, valid 1 hour, one-time)
Fetch it **immediately before** running `start.sh`. Use the **SV app URL (`sv.`)**, NOT the Scan URL.
```bash
curl -X POST "<SPONSOR_SV_URL>/api/sv/v0/devnet/onboard/validator/prepare"
# Sponsor SV URL pattern: https://sv.sv-1.<cluster>.global.canton.network.sync.global
# [UNKNOWN — exact DevNet cluster segment / GSF sponsor hostname; confirm at deploy time]
```

### B.4 — Get the Splice validator bundle + migration id
```bash
tar xzvf 0.6.10_splice-node.tar.gz          # use the current Splice release tag
cd splice-node/docker-compose/validator
export IMAGE_TAG=0.6.10                       # requires Docker Compose >= 2.26.0
```
Read the **current DevNet migration id** live from <https://sync.global/sv-network/>. It changes on every DevNet reset and mis-naming the participant DB breaks onboarding. **[UNKNOWN — read live]**

### B.5 — Deploy the validator
```bash
./start.sh -s "<SPONSOR_SV_URL>" -o "<ONBOARDING_SECRET>" -p "<org>-<fn>-1" -m "<MIGRATION_ID>" -w
# -s sponsor SV app URL | -o one-time secret (use -o "" on later restarts) | -p party hint
# -m migration id | -w wait-up | -c <scan_url> if not derivable | -a enable OIDC auth | -E bind nginx 0.0.0.0
# Restart after onboarding (data persists in volumes):
./start.sh -s "<SPONSOR_SV_URL>" -o "" -p "<org>-<fn>-1" -m "<MIGRATION_ID>" -w
./stop.sh
```
Brings up the Canton participant, validator app, Postgres, and wallet/CNS UIs. JSON Ledger API at `json-ledger-api.localhost`, gRPC at `grpc-ledger-api.localhost`, wallet at `http://wallet.localhost` (log in as `administrator` to finalize the validator-operator party).

### B.6 — Upload the Nelva DAR + allocate parties (auth required on DevNet)
On a real auth-enabled validator you **must** include a valid OIDC JWT (see Phase E for minting it).
```bash
curl -X POST "http://<json-ledger-api-host>/v2/packages?vetAllPackages=true" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer <JWT>" \
  --data-binary @D:/nelva/be/nelva-sc-0.1.0.dar

curl -d '{"partyIdHint":"NelvaOperator","identityProviderId":""}' \
  -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" \
  -X POST http://<json-ledger-api-host>/v2/parties
```

### Gotchas (Phase B)
- **2–7 day allowlist wait is the real bottleneck** — start B.1 days before you need the node.
- **One egress IP per network**, must be static and distinct from your other-network IPs.
- DevNet secret expires in **1 hour** and is one-time — fetch right before `start.sh`; use `-o ""` on restarts.
- Use the **`sv.`** URL for `prepare`, not `scan.` (common mistake).
- **DevNet resets ~every 3 months** — all parties, contracts, and the uploaded DAR are wiped; re-onboard, re-upload, re-allocate. Do not treat DevNet state as durable.
- Party ids are **minted by the participant** (`hint::fingerprint`), cannot be generated locally; allocate one stable party per account, avoid ephemeral parties (they cost).
- `start.sh` auto-layers traffic top-ups — ensure the operator party has enough CC/traffic or transactions stall.
- DevNet needs **whitelisted VPN access via your sponsoring SV** — NOT bundled in cn-quickstart (that's LocalNet-only).
- Pin `IMAGE_TAG` to a current release and match the DAR's Daml SDK LF version to the participant.

### Confidence: **HIGH** on the mechanism; **MEDIUM** on same-deadline feasibility (governed by the allowlist wait + organizer answer).
### Open questions (Phase B)
- **Exact DevNet `MIGRATION_ID`** — read live from sync.global at deploy time. **[UNKNOWN]**
- **Exact GSF/default DevNet sponsor SV hostname** for `prepare` and `-s`. **[UNKNOWN]**
- Is the docker-compose validator's JSON Ledger API **auth-protected by default** on DevNet (JWT mandatory for `/v2/packages` and `/v2/parties`)? Likely yes with `-a`, but the default + which OIDC issuer mints the JWT is unconfirmed. **[UNKNOWN]**
- Exact externally reachable **host/port for `json-ledger-api`** (docs say `json-ledger-api.localhost:80` via bundled nginx; real host depends on your nginx/`-E` binding and DNS). **[UNKNOWN]**
- Is `vetAllPackages=true` sufficient, or is an explicit `POST /v2/package-vetting` with `synchronizerId` also needed for the app to work across the synchronizer connection? **[UNKNOWN]**
- **Does this hackathon provide an organizer-hosted/pre-onboarded validator?** Strongly implied as the fast path — **must be confirmed in the organizer channel.** **[UNKNOWN — blocking decision]**

---

## 5. Phase C — Wallet Gateway deploy (self-custody dev mode)

**Outcome:** a hosted CIP-0103 Wallet Gateway next to the validator, with `rpcUrl` the FE's `RemoteAdapter` points at. **Self-custody dev mode exists and needs no paid custody provider — CONFIRMED.**

### C.1 — Does self-custody dev mode exist? YES.
`SigningProvider` enum = `WALLET_KERNEL` ('wallet-kernel'), `PARTICIPANT`, `FIREBLOCKS`, `BLOCKDAEMON`, `DFNS`. At startup, **`PARTICIPANT` and `WALLET_KERNEL` are ALWAYS registered** (internal Ed25519 driver, keys in `signingStore` DB); Fireblocks/Blockdaemon/Dfns register **only if their env vars are set**. So a config with just a `signingStore` runs fully self-custody. Docs: *"automatically available when a signingStore is configured. No additional setup required"* — intended for local dev / PoC, **explicitly not production**.

### C.2 — Run it (Docker)
Image is public on GHCR (no access request). **No `latest` tag** — pin a `<VERSION>` from GHCR/npm. **[UNKNOWN — pin the current stable version at deploy time]**
```bash
# Generate a sample config:
docker run --rm ghcr.io/digital-asset/wallet-gateway/docker/wallet-gateway:<VERSION> --config-example > config.json
# Run (persist data so judges' parties/keys survive restarts):
docker run -p 3030:3030 \
  -v ${PWD}/config.json:/app/config.json:ro \
  -v ${PWD}/data:/data \
  ghcr.io/digital-asset/wallet-gateway/docker/wallet-gateway:<VERSION>
# npx alternative (Node 24):
npx @canton-network/wallet-gateway-remote -c ./config.json
```
Endpoints: User UI `http://HOST:3030/`, dApp JSON-RPC `http://HOST:3030/api/v0/dapp`, User JSON-RPC `http://HOST:3030/api/v0/user`.

### C.3 — Minimal self-custody config skeleton
```json
{
  "kernel":   { "id": "remote-da", "clientType": "remote", "publicUrl": "https://wallet.<your-host>" },
  "server":   { "port": 3030, "dappPath": "/api/v0/dapp", "userPath": "/api/v0/user",
                "allowedOrigins": ["https://<your-dapp-origin>"], "admin": "operator" },
  "store":        { "connection": { "type": "sqlite", "database": "/data/store.sqlite" } },
  "signingStore": { "connection": { "type": "sqlite", "database": "/data/signing_store.sqlite" } },
  "bootstrap": {
    "idps": [ { "id": "idp-self-signed", "type": "self_signed", "issuer": "self-signed" } ],
    "networks": [ {
      "id": "canton:localnet", "name": "LocalNet", "identityProviderId": "idp-self-signed",
      "auth":      { "method": "self_signed", "issuer": "self-signed",
                     "audience": "https://canton.network.global",
                     "scope": "openid daml_ledger_api offline_access",
                     "clientId": "ledger-api-user", "clientSecret": "unsafe" },
      "adminAuth": { "...": "same as auth" },
      "ledgerApi": { "baseUrl": "http://localhost:2975" }
    } ]
  }
}
```
For DevNet, change `ledgerApi.baseUrl` to the validator's JSON Ledger API and (Phase E) swap the `self_signed` IDP for a real OIDC one. **Omit all Fireblocks/Blockdaemon/Dfns env vars to stay self-custody.**

### C.4 — Hosting checklist for a remote judge
- Set `kernel.publicUrl` to your **external HTTPS** URL (OAuth redirects + CIP-0103 discovery depend on it).
- Terminate **TLS** at an ingress/reverse proxy in front of `:3030`.
- Set `server.allowedOrigins` to your dApp origin(s) (not `*`).
- Use the **`wallet-kernel`** signing provider when creating wallets.
- Back stores with **SQLite-on-volume or Postgres** (memory store loses everything; Postgres recommended for concurrent judges).
- Validator prerequisite: the validator must **trust the JWTs the gateway issues** (matching issuer/audience). For the demo, a `self_signed` IDP works **only** if the validator's Ledger API is configured to accept unsafe self-signed tokens (true on sandbox/LocalNet; on DevNet you need real OIDC — Phase E).

### Gotchas (Phase C)
- The browser-**extension** gateway (in-browser keys) is **`[NOT IMPLEMENTED YET]`**. "In-browser self-custody" for the judge really means keys live in **our** gateway's `signingStore`, not the judge's browser.
- The internal driver stores **raw private keys** in the gateway DB; docs warn *"clients' private keys will be lost"* if the DB is lost. **Fine for a hackathon, never for real funds.** Persist `/data`.
- `self_signed` only works against a validator that accepts those tokens. *"Logged in!"* in the UI does **not** prove ledger connectivity — watch for HTTP 500 on `addSession`, HTTP 429 rate-limit.
- **Participant-based** signing is unsafe if the User API is public (anyone who can `createWallet` can sign via your participant). For a public demo prefer **wallet-kernel** or lock down who can `createWallet`.
- A **separate** `@canton-network/wallet-sdk` allocates external-key parties and signs directly against the Ledger API **without** a gateway — that's Nelva's *existing* external-signing/BE-relay recipe. Don't confuse it with this gateway path.

### Confidence: **HIGH** that self-custody dev mode works for the demo.
### Open questions (Phase C)
- Does Nelva's DevNet validator accept the gateway's `self_signed` JWTs out of the box, or must its Ledger API auth (issuer/audience) be reconfigured to trust `self-signed`? **Needs a live test.**
- Exact pinned `<VERSION>` for the Docker image / npm package. **[UNKNOWN — confirm on GHCR]**
- With `wallet-kernel`, does `createWallet()` also need the validator to grant the new party onboarding rights / a ledger user, or does `adminAuth` handle allocation entirely? **[UNKNOWN]**
- SQLite vs Postgres threshold for concurrent judges (docs recommend Postgres but give no number). **[UNKNOWN]**
- Will CIP-0103 Discovery auto-surface a purely-remote hosted gateway to a judge's browser, or must we hardcode the `RemoteAdapter` (gateways.json suggests manual registration is the reliable path)? → We already hardcode it in `canton.ts`, so this is handled.

---

## 6. Phase D — FE dApp-SDK wiring

**Outcome:** the FE talks to the hosted gateway. **`canton.ts` already exists and implements the full flow** — Phase D is mostly *configuration + verification*, not new code.

### D.1 — What's already wired (verified in `D:\nelva\frontend\src\lib\wallet\canton.ts`)
- `RemoteAdapter({ providerId: "nelva-gateway", rpcUrl: CANTON_GATEWAY_URL, name, description })` registered when `CANTON_GATEWAY_URL` is set, plus an `ExtensionAdapter` for any installed CIP-0103 extension.
- `init({ defaultAdapters, enableSuggestedWallets: true })` once, then `connect()` opens the **Discovery picker**.
- `connectCantonWallet()` → picker → `listAccounts()` → primary `partyId`.
- `restoreCantonWallet()` re-attaches a persisted session on mount (no picker).
- `submitViaCantonWallet(commands, disclosedContracts)` → `prepareExecuteAndWait({ commands, disclosedContracts })` — **same Ledger-API `CreateCommand`/`ExerciseCommand` objects the embedded path builds**, so command construction in `commands.ts` is reused verbatim; only the submit transport differs.
- Gate: `cantonWalletEnabled()` = `Boolean(CANTON_GATEWAY_URL)`; unset → dormant, embedded wallet only.

### D.2 — The only config step
Set the gateway URL (LocalNet in Phase A, hosted gateway later):
```
# D:\nelva\frontend\.env.local
NEXT_PUBLIC_CANTON_GATEWAY_URL=https://<gateway-host>/api/v0/dapp
```
Flipping LocalNet → DevNet is **a URL change only** — no FE code change (the gateway is pre-bound to its network).

### D.3 — Verify the SDK surface against the installed 1.3.0 d.ts (do not trust docs blindly)
- `RemoteAdapter` config is **only** `{ name, rpcUrl, providerId?, icon?, description? }` — **no** `network` / `ledgerApi` / `accessToken` fields. The network is selected **purely by `rpcUrl`**. Network info (`networkId`, `ledgerApi`, `accessToken`) and `synchronizerId` flow **from** the wallet (in `StatusEvent.network` / per-contract `createdEventBlob`), not from FE config.
- The wallet picker is a **Lit web component** auto-wired as the default (`this.walletPicker ?? pickWallet`). A normal dApp using `init()/connect()` should **not** import or render `core-wallet-ui-components` for the picker — it just works. (`canton.ts` correctly does not.)
- `prepareExecute` returns `null` (fire-and-forget; outcome via `onTxChanged`); **`prepareExecuteAndWait`** resolves with `{ tx: { status: 'executed', payload: { updateId, completionOffset } } }`. `canton.ts` uses the `*AndWait` variant — correct for a synchronous proof.
- `listAccounts()` may return a **single Wallet** object instead of an array from some wallets — `canton.ts`'s `primaryParty` does `wallets.find(...) ?? wallets[0]`, which assumes an array. **Add a normalize step** if a target wallet returns a single object (the `ping` example ships `normalizeWalletList`). *(Minor hardening — verify against the actual gateway.)*
- Supply a `commandId` (uuid v4) per submission for idempotency/tracking — consider adding it to `submitViaCantonWallet` params (`PrepareExecuteParams` accepts `commandId`, `actAs`, `readAs`, `disclosedContracts`, `synchronizerId`, `packageIdSelectionPreference`).
- `templateId` supports the `#package-name:Module:Entity` alias; pair with `packageIdSelectionPreference` if multiple DAR versions are uploaded.

### D.4 — disclosed contracts (token-standard / cross-party reads)
If a Nelva flow reads contracts owned by another party, pass `disclosedContracts: [{ createdEventBlob, templateId?, contractId?, synchronizerId? }]` — `createdEventBlob` is required, the rest pass through verbatim. `submitViaCantonWallet` already accepts `disclosedContracts`. Omit `synchronizerId` to let the gateway pick.

### Gotchas (Phase D)
- **Endpoint-path skew** again: confirm `/api/v0/dapp` vs `/api/json-rpc` for the pinned gateway. `env.ts` default is empty, so the value is always explicit — good.
- Don't pass `network`/`accessToken` into `RemoteAdapter` — silently ignored (`ProviderAdapterConfig` is just `{ name }`).
- `connect(options)` for passing adapters is **deprecated** — adapters go to `init()`. `init()` is idempotent; only the **first** call's options establish the adapter set. `canton.ts` does this correctly via `ensureInit()`.

### Confidence: **HIGH** — `canton.ts` matches the verified 1.3.0 API surface; Phase D is config + a small normalize hardening.
### Open questions (Phase D)
- Does the target deployment use a **remote** gateway (our case), a browser-**extension** wallet, or **WalletConnect**? We register Remote + Extension; confirm against the wallet judges actually use.
- Exact `networkId` string of the target network — read from `StatusEvent.network` at runtime, don't hardcode.
- Confirm dapp-sdk 1.3.0 is wire-compatible with the **pinned gateway release** (the two repos version independently).

---

## 7. Phase E — Production auth (OIDC/JWT)

**Outcome:** replace the BE's dev **"Bearer = party name"** scheme (`server.ts:45-48`) with real OIDC/JWT, and configure the validator to trust those tokens. **Required for DevNet** (sandbox/LocalNet can stay on self-signed/unsafe).

### E.1 — The validator auth model (what the token must look like)
RS256 JWTs from an OIDC provider (**Keycloak** is the documented default; Okta/Auth0 supported). Two accepted shapes — the Splice/Keycloak stack uses **both**:
- audience-based: `aud = https://canton.network.global` (or the participant URL)
- scope-based: `scope` contains `daml_ledger_api`

**Critical:** `actAs`/`readAs` rights are **NOT in the token**. The participant verifies sig/exp/iss/aud, reads `sub` as a ledger-api **user id**, and looks **that user's** `canActAs`/`canReadAs` grants up on the participant. So provisioning the ledger-api user + its grants is mandatory; a valid token for an unprivileged `sub` still fails.

### E.2 — The CIP-0103 write/read split (confirmed — keep it)
All writes needing a *user's* authority go through interactive submission: BE/gateway calls **`prepare`** (only needs `readAs` of the party) → the **wallet signs the tx hash** with the external party's key (never leaves the user) → BE/gateway relays **`execute`** with `party_signatures`. Neither the operator nor the BE needs `actAs` of the user. This is exactly what `server.ts` already exposes (`/api/wallet/prepare`, `/api/wallet/execute`, `/api/wallet/onboard`, `/api/wallet/allocate`). **Keep it.**
- BE **service token** carries only `canReadAs` for the parties it queries; `canActAs` **only** for operator/matcher parties the BE legitimately drives (Nelva's `runMatch`/`seed`/`liquidate`/`setPrice` operator routes).
- End-user external parties: **no BE `actAs`** — they self-authorize via prepare/execute signatures.

### E.3 — Concrete steps to replace the dev scheme
1. **IdP:** stand up / point at the OIDC provider (Keycloak fronting the validator). Register: (i) a `daml_ledger_api` client scope whose audience mapper injects `https://canton.network.global`; (ii) the BE **service-account** client (`client_credentials`); (iii) the public/SPA client the CIP-0103 wallet/dApp uses (Authorization Code + PKCE) for end-user tokens.
2. **Participant trust config** (validator env):
```
AUTH_JWKS_URL=https://{keycloak}/realms/{realm}/protocol/openid-connect/certs
AUTH_WELLKNOWN_URL=https://{keycloak}/realms/{realm}/.well-known/openid-configuration
LEDGER_API_AUTH_SCOPE=daml_ledger_api
LEDGER_API_AUTH_AUDIENCE=https://canton.network.global
VALIDATOR_AUTH_CLIENT_ID=validator-app-backend
VALIDATOR_AUTH_CLIENT_SECRET=***
LEDGER_API_ADMIN_USER=<service-account-user-id>
```
3. **Users + rights:** create ledger-api users. BE service user (`sub` from `client_credentials`, typically `CLIENT_ID@clients`) → `canReadAs` only (+ `canActAs` for the operator party). End users → no BE `actAs`.
4. **BE inbound middleware** (`D:\nelva\be\src\server.ts`, replacing `who()`/`requireParty` at server.ts:31-54): extract Bearer → fetch+cache JWKS (`jwks-rsa`) → `jwt.verify(token, { algorithms: ['RS256'], audience: LEDGER_API_AUTH_AUDIENCE, issuer })` → derive **party** from a verified claim or a server-side user→party table (never the raw bearer string) → derive **role** from a verified claim/group (never inferred from an attacker-supplied string). Reject on any failure with 401. Keep `requireRole`, but feed it the **verified** role.
5. **BE service token** (for reads + driving `prepare`):
```bash
curl -X POST "https://{keycloak}/realms/{realm}/protocol/openid-connect/token" \
  -d grant_type=client_credentials -d client_id=validator-app-backend \
  -d client_secret=$SECRET -d scope=daml_ledger_api
# decoded access_token must contain aud:[https://canton.network.global], scope:daml_ledger_api,
# sub == an existing ledger-api user id (e.g. validator-app-backend@clients)
```
6. **Hardening:** short-lived tokens (5–15 min) + refresh; rotate `VALIDATOR_AUTH_CLIENT_SECRET`; CORS locked to `FE_ORIGIN`; keep the rate limiter; never log tokens; strict `aud` validation; treat the operator-`actAs` user as a high-value secret.

### Gotchas (Phase E)
- **Rights are never in the JWT** — putting `actAs`/`readAs` in claims does nothing. Provision the user + grants on the participant.
- **`sub` must EXACTLY match** a ledger-api user id (often `CLIENT_ID@clients`); mismatch = authenticated-but-unauthorized.
- **Don't blindly forward the user's browser token as ledger authority.** The user's authority for a WRITE comes from their wallet **signature** in `execute`, not their bearer token. The BE is the policy enforcement point.
- **`PrepareSubmission` needs only `readAs`** — do NOT grant the BE `actAs` of every user; that would break the whole external-signing security model.
- The current demo token (literal party string) **never expires and is trivially forgeable** — that is precisely the vulnerability being closed.
- **Role must come from a verified claim/group**, not from the request (today `requireRole` derives role from the attacker-controlled bearer).
- Non-default IdPs: user tokens from a second issuer must carry `iss` matching the configured `identity-provider-id`, registered via `IdentityProviderConfigService`.

### Confidence: **HIGH** on the model; **MEDIUM** on specifics that depend on the chosen validator.
### Open questions (Phase E)
- **Which OIDC provider backs the actual DevNet validator Nelva uses?** Keycloak is assumed; a NaaS validator may mandate Auth0/Okta with a fixed `aud`. Confirm exact `aud` and audience-vs-scope expectation before coding the verifier. **[UNKNOWN]**
- Does the validator expose the JSON Ledger API publicly with its own IdP, or must the BE be the only co-located ledger client (always relay through the BE)? **[UNKNOWN]**
- App-user → Daml party mapping: a 1:1 user→party table, or a custom JWT claim? Decide before writing the verified-claims→party mapping. **[UNKNOWN]**
- Should operator automation (`runMatch`/`liquidate`/`setPrice`/`seed`) run as a participant-local (internal) party with BE `actAs`, or also be externally signed? (Internal party + BE `actAs` is simpler and the normal pattern.)

---

## 8. Execution order (one screen)

1. **Day 0, parallel:** Phase **B.0** — ask organizers about a shared/pre-onboarded validator. If none, fire **B.1** (SV sponsor + IP allowlist) immediately — 2–7 day wait.
2. **Day 0–2:** Phase **A** — LocalNet + gateway + `ping`, then point `canton.ts` at `http://localhost:3030/api/v0/dapp`, upload `nelva-sc-0.1.0.dar`, prove `connect → listAccounts → prepareExecuteAndWait`.
3. **When allowlist clears (or org validator ready):** Phase **B.3–B.6** — deploy DevNet validator, upload DAR, allocate parties.
4. **Then:** Phase **C** — host the Wallet Gateway (self-custody `wallet-kernel`) next to the DevNet validator over HTTPS.
5. **Then:** Phase **D** — set `NEXT_PUBLIC_CANTON_GATEWAY_URL` to the hosted gateway (URL change only); add the `listAccounts` normalize + `commandId` hardening.
6. **For DevNet auth:** Phase **E** — replace "Bearer = party name" with OIDC/JWT, configure validator trust, provision users + grants.
7. **At every step, fallback intact:** unset `CANTON_GATEWAY_URL` → embedded wallet only, app unchanged.

**Single biggest risk:** the 2–7 day DevNet IP-allowlist wait. Mitigation: confirm an organizer-provided validator (B.0) and keep the embedded wallet as the guaranteed fallback.
