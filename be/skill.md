# Nelva BE — Anti-Hallucination Skill (Backend / off-ledger Canton clients)

> READ THIS BEFORE WRITING ANY BACKEND CODE FOR NELVA.
> This file pins exact versions, exact JSON Ledger API v2 request/response shapes, and a DO-NOT list of plausible-but-wrong things. Every load-bearing fact here was verified against live sources (see DOC LINKS). Anything not fully verified is marked **(UNVERIFIED)**.

---

## 1. What this is & the BE mission

**Project = Nelva**: "ATM of GHOST onto Canton" — private sealed-bid P2P lending with deterministic, auditable matching (Canton Network, Track 1 Private DeFi).

**The smart contracts (Daml) are the heart. The backend is THIN.** All correctness, matching, authorization, and money logic live on-ledger in Daml. See `d:\nelva\sc\skill.md`.

**Nelva BE = off-ledger Canton clients ONLY.** The backend never decides who matches whom, never computes rates, never holds authority the ledger doesn't already give it. It only: builds JWTs, submits choices the parties authorize, and reads/streams the ledger. The four BE services:

| Service | Job | Ledger interaction |
|---|---|---|
| **Operator cron bot** | On a schedule, submit the `RunMatch` choice on the open `MatchRound` | `POST /v2/commands/submit-and-wait` exercising `RunMatch` (authority comes from signatory-propagation in the Daml model, NOT from the bot) |
| **PriceOracle bot** | Write fresh `PriceUpdate` contracts | `POST /v2/commands/submit-and-wait` with `CreateCommand` for `PriceUpdate` |
| **Veridian-Scan gateway** | Public, party-scoped read/query API over the ledger | `POST /v2/state/active-contracts` + `POST /v2/updates`, per-party JWT (NOT PQS — see gotchas) |
| **Attestor fold (optional)** | Re-derive/verify match results from the event log | PQS (participant-scoped read store) or `/v2/updates` stream |

**Hard rule:** the operator bot has **no god-mode**. It submits `RunMatch`; the lender's signature on each `SealedBid` propagates into the `Loan` created inside that choice. If you find yourself wanting the bot to be a signatory of loans, STOP — the model is wrong, not the bot.

---

## 2. VERIFIED VERSIONS / PINS (BE-relevant)

| Thing | Pin | Notes |
|---|---|---|
| Node.js | >= 18 (LTS 20/22 fine) | MCP server engines say node>=18; pick an active LTS |
| TypeScript | current 5.x | not version-critical for BE |
| `openapi-fetch` | **0.17.0** | typed fetch client over the OpenAPI spec (verified npm latest) |
| `openapi-typescript` | latest | generates TS types from `/docs/openapi` (dev dependency) |
| `@daml/types` | **3.5.2** | used by `dpm codegen-js` output; stable latest. **Do NOT install `3.6.0-snapshot.*`** |
| `@daml/ledger` | **2.10.4 — DEAD** | JSON API v1; cannot talk to Canton 3.x. DO NOT USE |
| `@daml/react` | **2.10.4 — DEAD** | JSON API v1; FE-only anyway. DO NOT USE |
| `@c7-digital/ledger` | 0.0.29 (moves weekly) | OPTIONAL alt JSON Ledger API v2 client; supports 3.5.x prod + 3.4.11 local. Note: the package is `@c7-digital/ledger`, NOT `@c7/ledger` (that 404s). **(MEDIUM confidence it is "official"; pin exact version and test against a 3.4.11 DAR day-1.)** |
| JSON Ledger API | **v2**, base path `/v2`, default port **7575** | REST/WS facade over gRPC Ledger API. API self-version string "3.3.0"; OpenAPI spec on the 3.4 build = `3.4.12-SNAPSHOT` |
| gRPC Ledger API | default port **6865** | only needed as PQS/scribe `--source-ledger-port` |
| cn-quickstart app backend | port **8080** | NOT the ledger API — do not confuse with 7575 |
| Canton / DAML runtime | **3.4.11** (LTS via cn-quickstart `.env`, main branch) | live network is 3.5.x but DARs compile against 3.4.11 |
| Splice | 0.5.3 | from cn-quickstart `.env` |
| Scribe / PQS image | `participant-query-store:3.4.1`; Scribe version **0.6.15** | Enterprise-licensed |
| JDK | 21 (Eclipse Temurin) | only relevant if running scribe.jar / dpm locally |
| Keycloak | OAuth2 `client_credentials` | issues every JWT (mandatory on every call) |

> Versions come from the cn-quickstart `quickstart/.env` (main branch) and the npm registry. The MCP server's coarser pins (SDK "3.4", Splice "0.5.0", JDK 17+) are ADVISORY and trail these — trust this table.

---

## 3. JSON Ledger API v2 — EXACT usage

Base URL: `http://localhost:7575` (confirm the node's actual port; some quickstart configs show 8080 for the *app*, but the ledger API is 7575).

### 3.0 Universal rules (read first)
- **camelCase EVERYWHERE** in JSON: `createdEventBlob`, `templateId`, `contractId`, `createArgument`, `synchronizerId`, `includeCreatedEventBlob`. The gRPC/proto docs use snake_case (`created_event_blob`) — **never** copy proto field names into JSON; you will get a 400.
- **JWT is mandatory on EVERY request**, including an unsecured dev sandbox. There is no anonymous mode. Header: `Authorization: Bearer <JWT>`.
- **Offsets are int64 integers**, not opaque strings. Always `GET /v2/state/ledger-end` first to seed `activeAtOffset` / `beginExclusive`.
- **`userId`** is current; `applicationId` is the deprecated alias. Use `userId`.
- `actAs` in a request body must be a **subset** of the JWT user's granted rights — you cannot escalate via the body.
- Template ID format: prefer **package-NAME** form `#nelva:Nelva.SealedBid:SealedBid` (survives recompiles) over the package-hash form `<pkgId>:Module:Entity` (hash changes every recompile).

### 3.1 Get the ledger end (seed offsets)
```
GET /v2/state/ledger-end
Authorization: Bearer <JWT>
-> { "offset": 1234 }
```

### 3.2 Submit a command — `submit-and-wait` (JsCommands at TOP LEVEL)
```
POST /v2/commands/submit-and-wait
{
  "commands": [
    { "CreateCommand": {
        "templateId": "#nelva:Nelva.PriceUpdate:PriceUpdate",
        "createArguments": { "oracle": "Oracle::1220...", "asset": "GHOST", "price": "1.2345" }
    } }
  ],
  "commandId": "nelva-priceupdate-0001",
  "actAs": ["Oracle::1220..."],
  "readAs": [],
  "userId": "oracle-bot"
}
-> { "updateId": "...", "completionOffset": 42 }
```

Command variants inside `commands[]` (oneOf):
- `CreateCommand { templateId, createArguments }`
- `ExerciseCommand { templateId, contractId, choice, choiceArgument }`
- `CreateAndExerciseCommand { templateId, createArguments, choice, choiceArgument }`
- `ExerciseByKeyCommand { templateId, contractKey, choice, choiceArgument }` — **DO NOT USE** (contract keys are unsupported on 3.x; see SC skill)

Optional `JsCommands` fields: `workflowId`, `deduplicationPeriod` (`DeduplicationDuration` | `DeduplicationOffset` | `Empty`), `minLedgerTimeAbs`, `minLedgerTimeRel`, `submissionId`, `disclosedContracts[]`, `synchronizerId`, `packageIdSelectionPreference[]`, `prefetchContractKeys[]`.

### 3.3 Submit + get the transaction back — `submit-and-wait-for-transaction` (DIFFERENT SHAPE!)
JsCommands are **nested under `commands`** and there is a sibling `transactionFormat`. This is the single biggest trap.
```
POST /v2/commands/submit-and-wait-for-transaction
{
  "commands": {
    "commandId": "nelva-runmatch-0007",
    "commands": [
      { "ExerciseCommand": {
          "templateId": "#nelva:Nelva.MatchRound:MatchRound",
          "contractId": "<matchRoundCid>",
          "choice": "RunMatch",
          "choiceArgument": { "inputBidCids": ["<cid1>", "<cid2>"] }
      } }
    ],
    "actAs": ["Operator::1220..."],
    "userId": "operator-bot",
    "disclosedContracts": []
  },
  "transactionFormat": {
    "eventFormat": {
      "filtersByParty": { "Operator::1220...": { "cumulative": [
        { "identifierFilter": { "WildcardFilter": { "value": { "includeCreatedEventBlob": false } } } }
      ] } },
      "filtersForAnyParty": {},
      "verbose": false
    },
    "transactionShape": "TRANSACTION_SHAPE_LEDGER_EFFECTS"
  }
}
-> { "transaction": { "updateId", "commandId", "effectiveAt", "offset", "synchronizerId", "recordTime", "events": [...] } }
```
If `transactionFormat` is omitted, default `transactionShape` = `TRANSACTION_SHAPE_ACS_DELTA`.

### 3.4 Read the ACS — `active-contracts` (Veridian-Scan gateway)
```
POST /v2/state/active-contracts
{
  "activeAtOffset": 1234,
  "eventFormat": {
    "filtersByParty": {
      "<partyId>": { "cumulative": [
        { "identifierFilter": { "TemplateFilter": { "value": {
            "templateId": "#nelva:Nelva.SealedBid:SealedBid",
            "includeCreatedEventBlob": true
        } } } },
        { "identifierFilter": { "WildcardFilter": { "value": { "includeCreatedEventBlob": true } } } }
      ] }
    },
    "filtersForAnyParty": {},
    "verbose": true
  },
  "verbose": true
}
-> [ { "contractEntry": { "JsActiveContract": {
      "createdEvent": {
        "contractId", "templateId", "createArgument", "createdEventBlob",
        "signatories": [], "observers": [], "createdAt", "offset", "nodeId"
      },
      "synchronizerId", "reassignmentCounter"
} } }, ... ]
```
Use `eventFormat` (NOT the deprecated top-level `filter`/`verbose` positional fields).

### 3.5 Stream/poll updates — `/v2/updates` (operator loop, Attestor)
```
POST /v2/updates
{
  "beginExclusive": 0,
  "endInclusive": 0,
  "updateFormat": {
    "includeTransactions": {
      "transactionShape": "TRANSACTION_SHAPE_LEDGER_EFFECTS",
      "eventFormat": {
        "filtersByParty": { "<party>": { "cumulative": [
          { "identifierFilter": { "WildcardFilter": { "value": { "includeCreatedEventBlob": true } } } }
        ] } },
        "filtersForAnyParty": {},
        "verbose": false
      }
    },
    "includeReassignments": { "filtersByParty": {}, "filtersForAnyParty": {}, "verbose": false },
    "includeTopologyEvents": { "includeParticipantAuthorizationEvents": { "parties": [] } }
  }
}
```
Streamable over WebSocket or plain HTTP. Per-item response:
```
{ "update": { "Transaction": { "value": {
    "updateId", "offset",
    "events": [ { "CreatedEvent" | "ArchivedEvent" | "ExercisedEvent": {...} } ],
    "synchronizerId", "recordTime"
} } } }
```

`transactionShape` enum:
- `TRANSACTION_SHAPE_UNSPECIFIED`
- `TRANSACTION_SHAPE_ACS_DELTA` — party must be a **STAKEHOLDER** of the event (default)
- `TRANSACTION_SHAPE_LEDGER_EFFECTS` — party need only be a **WITNESS**. Use this when the operator/auditor watches others' actions.

Event field shapes:
- `CreatedEvent { offset, nodeId, contractId, templateId, createArgument, createdEventBlob, witnessParties, signatories, observers, createdAt, packageName, acsDelta }`
- `ArchivedEvent { offset, nodeId, contractId, templateId, witnessParties, packageName }`
- `ExercisedEvent { offset, nodeId, contractId, templateId, choice, choiceArgument, actingParties, consuming, witnessParties, lastDescendantNodeId, acsDelta }`

WebSocket auth uses two subprotocols: `daml.ws.auth` and `jwt.token.<jwt>`.

### 3.6 Explicit disclosure (cross-party SealedBid reads)
`createdEventBlob` is populated **only on demand**. Steps:
1. Query with `includeCreatedEventBlob: true` inside the relevant filter (`TemplateFilter` / `WildcardFilter` / `InterfaceFilter`).
2. Copy `createdEventBlob` + `templateId` + `contractId` (+ `synchronizerId`) from the returned `createdEvent` into a `disclosedContracts[]` entry on a later submit:
```
{ "templateId": "...", "contractId": "...", "createdEventBlob": "CgMyLjES0QQK...", "synchronizerId": "..." }
```
- Only contracts created on Canton >= 2.8 carry a blob.
- Disclosure proves the contract exists/was signed; it does **NOT** grant choice authority.

### 3.7 JWT (Keycloak, two-layer auth)
Get a token (cn-quickstart style):
```
curl -s -X POST 'http://localhost:8082/realms/AppProvider/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode 'client_id=<CLIENT_ID>' \
  --data-urlencode 'client_secret=<CLIENT_SECRET>' \
  --data-urlencode 'scope=daml_ledger_api' | jq -r .access_token
```
Minimal token claims:
```
{ "sub": "<userId>", "scope": "<target scope, e.g. daml_ledger_api>", "aud": [<participant/ledger id>], "exp": <ts> }
```
- `sub` = `userId`. That user must be a real Ledger API user (`POST /v2/users`) with `actAs` rights to the Daml party.
- `scope` must equal the participant's configured target scope.
- `aud` = audience (participant/ledger id) if configured.
- The exact realm/client/scope names are deployment-specific — confirm from the cn-quickstart `.env` and participant config day-1. **(MEDIUM: realm `AppProvider`, port `8082`, scope `daml_ledger_api` are typical cn-quickstart values; verify.)**

---

## 4. Codegen workflow

Two independent generators — you typically use both.

**(A) OpenAPI types + typed client (for raw v2 calls):**
```
# 1. Pull the LIVE spec from the running node (authoritative, node-specific):
curl -H "Authorization: Bearer $TOKEN" http://localhost:7575/docs/openapi -o openapi.json
# 2. Generate TS types:
npx openapi-typescript ./openapi.json -o ./generated/api/ledger-api.ts
# 3. Use with openapi-fetch:
```
```ts
import createClient from "openapi-fetch";
import type { paths } from "./generated/api/ledger-api";

const client = createClient<paths>({ baseUrl: "http://localhost:7575" });
const { data, error } = await client.POST("/v2/commands/submit-and-wait", {
  headers: { Authorization: `Bearer ${token}` },
  body: { /* JsCommands, camelCase, as in 3.2 */ },
});
```

**(B) Daml template bindings (for correct `templateId` strings + typed payloads):**
```
dpm codegen-js -o ./generated .daml/dist/<your-dar>.dar
# (old name was `daml codegen js` — the daml assistant is REMOVED; use dpm)
```
This emits `@daml/types@3.5.2`-based bindings, e.g. `SealedBid.SealedBid.templateId`. Install deps:
```
npm i openapi-fetch@0.17.0 openapi-typescript @daml/types@3.5.2
```

> Always fetch the OpenAPI spec from the **running node** `/docs/openapi`, not a static `.html`/`.yaml` from the docs site — the live spec reflects node-specific customizations.

---

## 5. How each Nelva BE service talks to the ledger

**Operator cron bot (submit RunMatch):**
1. `GET /v2/state/ledger-end` → offset.
2. `POST /v2/state/active-contracts` for the open `MatchRound` and all eligible `SealedBid` cids (with `includeCreatedEventBlob:true` if cross-party disclosure is needed).
3. `POST /v2/commands/submit-and-wait` (or `-for-transaction` to get the result tx) exercising `RunMatch` with the bid cids. Authority flows from each lender's signature on `SealedBid` — the bot is only the submitter.
4. The bot does **zero** matching math; `RunMatch` runs the deterministic algorithm on-ledger.

**PriceOracle bot (write PriceUpdate):**
- `POST /v2/commands/submit-and-wait` with a `CreateCommand` for `PriceUpdate`, `actAs: ["Oracle::..."]`. Prices as decimal strings (e.g. `"1.2345"`), not JSON numbers, to avoid float drift.

**Veridian-Scan public read gateway:**
- Use **party-scoped Ledger API reads** (`POST /v2/state/active-contracts` with `filtersByParty` = the requesting party; `POST /v2/updates` for live feeds). Each public caller gets a JWT for their own party so projection (privacy) is enforced by the ledger.
- **Do NOT** back this gateway with PQS — PQS is participant-scoped (sees everything the node sees) and would leak other parties' data.

**Attestor fold (optional, re-verify matches):**
- Either stream `POST /v2/updates` (`LEDGER_EFFECTS`) and fold `ExercisedEvent`/`CreatedEvent`, or query PQS. This is participant-internal verification, so PQS visibility is acceptable here. Re-deriving the match must call the same pure logic the Daml `Verify` choice uses (golden-vector parity is enforced on-ledger; the Attestor is a convenience, not the source of truth).

---

## 6. DO-NOT / anti-hallucination list

- **DO NOT use `@daml/ledger` or `@daml/react`** (2.10.4) — JSON API v1, dead on Canton 3.x. Use `openapi-fetch` + generated types (or optionally `@c7-digital/ledger`).
- **DO NOT use `@c7/ledger`** — 404s on npm. The real package is `@c7-digital/ledger`.
- **DO NOT send snake_case JSON** (`created_event_blob`, `create_argument`, `template_id`) — the JSON API is camelCase → 400.
- **DO NOT send JsCommands at the top level for `submit-and-wait-for-transaction`** — it must be nested under `commands`, with a sibling `transactionFormat`.
- **DO NOT use Daml Triggers** for the event loop — deprecated/2.x-only. Use `POST /v2/updates` streaming or PQS polling.
- **DO NOT trust Splice Scan to serve custom Nelva contracts** — Scan serves only Amulet/network data. Build your own read service (Veridian-Scan) over JSON Ledger API v2.
- **DO NOT put match/rate/eligibility logic in the BE** — it lives in the Daml `RunMatch` choice and the shared pure `runDeterministicMatch` module. The bot only submits.
- **DO NOT give the operator bot extra authority / make it a signatory of loans** — rely on signatory-propagation from `SealedBid` into `Loan`.
- **DO NOT compute hashes on-ledger** — `DA.Crypto.Text` (sha256/keccak256/secp256k1) is ALPHA in 3.x with `BytesHex -> BytesHex` signatures. Compute any hashes **off-ledger in Node/JVM** and pass them in.
- **DO NOT use the deprecated `/v2/updates/flats` or `/v2/updates/trees`** REST/WS variants, or `submit-and-wait-for-transaction-tree`. Use unified `POST /v2/updates` with `updateFormat`.
- **DO NOT use the deprecated top-level `filter`/`verbose` request fields** — use `eventFormat`.
- **DO NOT use contract keys** (`ExerciseByKeyCommand`, `prefetchContractKeys` for correctness) — keys are unsupported on Canton 3.x. Single-active invariants are enforced in Daml/business logic.
- **DO NOT expect anonymous access** — a JWT is mandatory even on a dev sandbox.
- **DO NOT assume `disclosedContracts` works without first fetching with `includeCreatedEventBlob:true`** — the blob is on-demand only.
- **DO NOT pin `templateId` to a package hash** in long-lived code — use `#package-name:Module:Entity`; hashes change on recompile.
- **DO NOT install `@daml/types@3.6.0-snapshot.*`** — stable latest is 3.5.2.
- **DO NOT use the `daml` assistant** (`daml codegen js`, etc.) — removed in SDK 3.5; use `dpm`.

---

## 7. Gotchas

- **submit-and-wait vs submit-and-wait-for-transaction** have different request shapes (top-level vs nested + `transactionFormat`). Most common 400.
- **camelCase vs proto snake_case** — reading gRPC/proto docs and copying field names breaks JSON.
- **Two-layer auth:** (1) the JWT (Keycloak `client_credentials`) carries the user + scope + audience; (2) the request-body `actAs`/`readAs` must be a SUBSET of that user's granted rights. You can narrow in the body, never escalate. The Ledger API user (with `actAs` on the Daml party) must already exist (`POST /v2/users`).
- **PQS lag + visibility:** PQS reflects PARTICIPANT-level visibility (everything the node sees, not one party's projection) AND lags the ledger by seconds. Use PQS only for the Attestor/internal fold; use party-JWT Ledger-API reads for the public Veridian-Scan gateway.
- **`transactionShape` default is `ACS_DELTA`** (stakeholder-only). For watching others' actions set `LEDGER_EFFECTS` explicitly.
- **Offsets:** integers, seed from `GET /v2/state/ledger-end` before active-contracts/updates.
- **Ports:** JSON Ledger API 7575; gRPC (PQS source) 6865; cn-quickstart app backend 8080. Confirm the running node's actual port.
- **Enterprise license:** PQS/scribe and the cn-quickstart runtime DARs are Daml Enterprise — a license may be required even on LocalNet. Verify day-1.
- **PriceOracle freshness:** the Daml side likely re-checks price validity windows; the bot just keeps writing fresh `PriceUpdate`s — don't bake business rules into the cron interval.
- **`@c7-digital/ledger` churns** (0.0.x, ~weekly): if you adopt it, pin the exact version and test against a 3.4.11-compiled DAR (it defaults to a 3.5.1-snapshot build; `dpm sandbox --sdk-version=3.4.11` is its documented local path). **(MEDIUM/UNVERIFIED for our exact DAR.)**

### PQS / scribe quick reference (Attestor fold)
```
# Postgres
docker run --name postgres-pqs -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:latest
# Scribe pipeline (image participant-query-store:3.4.1)
./scribe.jar pipeline ledger postgres-document \
  --source-ledger-host localhost --source-ledger-port 6865 \
  --target-postgres-host localhost --target-postgres-port 5432 \
  --target-postgres-database postgres --pipeline-ledger-start Oldest
# With OAuth:
#   --source-ledger-auth OAuth --pipeline-oauth-clientid <id> \
#   --pipeline-oauth-clientsecret <secret> --pipeline-oauth-endpoint <token-url>
#   (--pipeline-oauth-cafile <pem> for TLS)
```
SQL functions: `active(name,[at_offset])`, `creates(name,[from],[to])`, `archives(...)`, `exercises(...)`, `lookup_contract(cid)`. Columns: `contract_id` (text), `payload` (jsonb), `created_at_offset` (bigint), `created_effective_at`, `signatories` text[], `observers` text[]. `name` accepts fully-qualified `package:Module:Template`, `Module:Template`, or bare `Template`.
```sql
select contract_id, payload from active('#nelva:Nelva.Loan:Loan')
where payload @> '{"status":"Open"}';
```
> Scribe auth flag names assembled from docs snippets — **(MEDIUM: verify against the running `scribe.jar --help`.)**

---

## 8. Authoritative DOC LINKS

- **Canonical docs (use the machine index):** https://docs.canton.network/ and its index https://docs.canton.network/llms.txt (site search is unreliable — use llms.txt).
- **Legacy mirror (matches 3.4 LTS pin; banners back to canton.network):** https://docs.digitalasset.com/build/3.4/ (and `/build/3.5/`).
- **JSON Ledger API reference:** docs.canton.network → reference/json-api-reference; plus the 3.4 JSON-API curl + TypeScript tutorials on the legacy mirror.
- **LIVE OpenAPI spec (authoritative, node-specific):** `GET http://<node>:7575/docs/openapi`.
- **DPM reference:** https://docs.digitalasset.com/build/3.4/dpm/dpm.html (codegen-js, sandbox, etc.).
- **cn-quickstart (version source of truth = `quickstart/.env`, main branch):** https://github.com/digital-asset/cn-quickstart
- **`@c7-digital/ledger`:** npm `@c7-digital/ledger`, repo C7-Digital/c7_ledger.
- npm: `openapi-fetch`, `openapi-typescript`, `@daml/types`.

### Canton MCP setup (docs/version sanity-check helper — advisory only)

The Canton Dev MCP server is a curated, auto-updating **docs/knowledge** server (it gives the AI current links, version pins, and deprecation flags). It does **NOT** build, deploy, submit, or query a ledger — keep using `dpm` + the JSON Ledger API directly. Its version pins are coarser/older than this skill's (it says SDK "3.4", Splice "0.5.0", JDK 17+) — treat as advisory; trust this skill's table.

- npm package: `@canton-network-devs/canton-mcp-server` (latest 2.2.1, published 2026-06-25).
- The one-shot installer `npx @canton-network-devs/canton-mcp-server install` writes **Claude Desktop** config only (`%APPDATA%/Claude/claude_desktop_config.json` on Windows). It does **NOT** wire up Claude Code / Agent SDK.
- **For Claude Code (this environment) add it manually:**
```
claude mcp add canton-dev -- npx -y @canton-network-devs/canton-mcp-server
```
or in `.mcp.json`:
```json
{ "mcpServers": { "canton-dev": { "command": "npx", "args": ["-y", "@canton-network-devs/canton-mcp-server"] } } }
```
- **(DERIVED, UNVERIFIED in this env:** the `claude mcp add` line is correct in form, built from the verified `{command, args}` shape; the README documents Claude Desktop only.)
- Most useful tools for anti-hallucination: `canton_check(name)` (is a package/command deprecated?), `canton_lookup(query)`, `canton_api_ref(api)`. Resources: `canton://deprecations`, `canton://versions`. **Workflow: use the MCP to FLAG deprecation, then verify against docs.canton.network/llms.txt before acting.**
- It does an outbound fetch to raw.githubusercontent.com on startup (10s timeout) then falls back to cache/bundled data — on an offline box its data may be stale.

---

## 9. Quick checklist before you ship a BE service

1. JWT obtained from Keycloak (`client_credentials`), correct `scope`/`aud`, matching Ledger API user with `actAs`?
2. `GET /v2/state/ledger-end` called to seed offsets?
3. All JSON camelCase? `templateId` in `#name:Module:Entity` form?
4. `submit-and-wait-for-transaction` body nested under `commands` with `transactionFormat`?
5. Cross-party reads use `includeCreatedEventBlob:true` then carry `disclosedContracts[]`?
6. `transactionShape` set explicitly (`LEDGER_EFFECTS` for watching others)?
7. Zero business logic in the BE — matching/rates/auth all on-ledger?
8. Public gateway uses party-scoped Ledger API reads, NOT PQS?
9. Any hashing done off-ledger?
10. No `@daml/ledger`/`@daml/react`/Daml Triggers/contract keys/deprecated endpoints?
