# Nelva SC — Daml Smart-Contract Build Skill (anti-hallucination)

> **What this is.** A pinned, verified build guide for the **Nelva** smart-contract layer (Daml on Canton). It exists to stop a future AI from hallucinating deprecated Daml 2.x tooling, wrong syntax, or non-existent functions. Every load-bearing fact below was cross-checked against live sources (docs.canton.network, docs.digitalasset.com/build/3.4–3.5, cn-quickstart `.env`, npm). Items not confirmed against a live source are marked **(UNVERIFIED)**.
>
> **Nelva SC mission.** Nelva = *ATM of GHOST onto Canton* — private, sealed-bid P2P lending with **deterministic, auditable matching** (Track 1, Private DeFi). The Daml layer is the heart: lenders post sealed bids whose funds are locked at bid time; an operator runs a **pure, deterministic** matching algorithm to create Loans via **signature-propagation** (no operator god-mode); an auditor independently re-runs the *same* pure function and the result must match **byte-for-byte** (the golden-vector test).
>
> Repo layout: `d:\nelva\sc` (this — Daml) and `d:\nelva\be` (off-ledger Canton clients). FE (Bima) is out of scope here.

---

## 1. VERIFIED VERSIONS / PINS

Source of truth = **cn-quickstart `quickstart/.env`** (main branch, NOT git tags).

| Component | Pin | Notes |
|---|---|---|
| Daml SDK / Runtime | **3.4.11** | LTS line. `dpm install 3.4.11`. Live network is 3.5.x but we **compile DARs against 3.4.11**. |
| Splice | **0.5.3** | `.env` value (docs prose loosely says 0.5.0 — trust `.env`). |
| Scribe / PQS | **0.6.15** | (BE concern; listed for consistency.) |
| JDK | **21** (Eclipse Temurin) | dpm page says "17 or greater"; cn-quickstart pins 21 → install 21. |
| OpenTelemetry agent | 2.10.0 | from `.env`. |
| Tooling CLI | **DPM** ("Digital Asset Package Manager") | The old `daml` assistant is **REMOVED** in SDK 3.5. |
| `@daml/types` (codegen runtime) | **3.5.2** | stable latest; do NOT use `3.6.0-snapshot.*`. Version skew vs 3.4.11 DAR is expected/OK. |
| Daml Studio | needs VS Code **1.87+** | `dpm studio`. |
| LocalNet RAM | **~16 GB** under WSL2 | cn-quickstart README says 8 GB min; pin = 16 GB. Set `.wslconfig`. |

**Platform note (Windows 11 user):** run the Canton stack itself in **WSL2**. Native-Windows DPM is only the CLI.

---

## 2. PROJECT SETUP + EXACT DPM COMMANDS

### Install DPM
```bash
# Mac/Linux (and WSL2):
curl https://get.digitalasset.com/install/install.sh | sh
# Windows native CLI only: download + run https://get.digitalasset.com/install/latest-windows.html
dpm install 3.4.11        # pin SDK to the LTS line cn-quickstart uses
dpm version --all -o json # machine-readable list of installed/available SDKs
```
`DPM_HOME` relocates the SDK; default Windows `%APPDATA%/.dpm/`, Mac/Linux `${HOME}/.dpm/`.

### Daily SC iteration (no LocalNet needed)
```bash
dpm init                 # scaffold a project (or: dpm new <proj> --template daml-intro-contracts)
dpm build                # compile one package -> .daml/dist/<pkg>.dar
dpm build --all          # multi-package build (multi-package.yaml)
dpm test                 # run ALL Daml Script tests  (Nelva golden-vector test runs here)
dpm test --files Nelva_Test.daml      # run one test file
dpm sandbox              # full Canton in a single process (fast SC loop)
dpm studio               # launch Daml Studio (VS Code 1.87+)
dpm inspect-dar / dpm validate-dar / dpm damlc inspect-dar assets.dar [--json]
```

### Codegen (for BE/FE bindings)
```bash
dpm codegen-js ./.daml/dist/<project>-<version>.dar -o ./generated -s daml.js
# positional = DAR path; -o = output dir; -s = npm scope (default daml.js). Generated TS depends on @daml/types@3.5.2.
```

### Full-stack LocalNet (run in WSL2)
```bash
git clone https://github.com/digital-asset/cn-quickstart.git   # main branch + .env, NOT tags
direnv allow
cd quickstart && make setup && make build && make start
make canton-console     # separate shell — interactive Scala REPL
make capture-logs
make clean-all          # before rebuilding old checkouts (architecture changed 2025-07-02)
make stop
```
Ports: App-User gRPC LAPI 2901, App-Provider 3901, SV 4901; App-User JSON API 2975; participant admin 2902/3902/4902; wallets at `wallet.localhost:2000/3000`, `sv.localhost:4000`. JSON Ledger API default = **7575**; gRPC Ledger API default = **6865**.

### `daml.yaml` (verbatim shape)
```yaml
sdk-version: 3.4.11        # pin
name: nelva
version: 1.0.0
source: daml
dependencies:
  - daml-prim
  - daml-stdlib
data-dependencies:
  - ./path/to/dep.dar
build-options:
  - --output=./.daml/dist/nelva.dar
# multi-package.yaml:  packages: [ ./pkg1, ./pkg2 ]
```

---

## 3. DAML SYNTAX CHEATSHEET (real snippets)

### Template / signatory / observer / ensure / key
```haskell
template NameOfTemplate
  with
    exampleParty  : Party
    exampleParty2 : Party
    exampleParameter : Text
  where
    signatory exampleParty      -- REQUIRED. authorizes AND sees.
    observer  exampleParty2     -- optional. sees only, does NOT authorize.
    ensure True                 -- optional precondition, checked AT CREATE only.
    -- key/maintainer EXIST in the language but are UNSAFE on Canton 3.x (see DO-NOT). Avoid.
```
- `this` = current contract record; `self` = `ContractId T` inside a choice.
- **No template-local `let` in the `where` block** (deprecated since 2.8).
- **No field-level privacy** inside a template — split sensitive legs into separate contracts and rely on sub-transaction projection.

### Choices: consuming / nonconsuming / controller / observer
```haskell
-- default = consuming: contract is ARCHIVED before the body runs.
choice NameOfChoice : ()
  with party : Party
  controller party
  do return ()

-- nonconsuming: contract SURVIVES — use for Verify / read-style / re-runnable choices.
nonconsuming choice ExampleRead : Int
  controller someParty
  do pure 0
-- preconsuming / postconsuming also exist (mutually exclusive qualifiers).

-- multiple controllers => authority of ALL is required; optional per-choice observer:
choice Mutual_Transfer : ContractId Iou
  with newOwner : Party
  observer newOwner
  controller owner, newOwner
  do create this with owner = newOwner
```

### Do-block actions (verbatim)
```haskell
cid <- create T with field = v
r   <- exercise cid Choice with arg = v
c   <- fetch cid
archive cid
-- exerciseByKey / fetchByKey / lookupByKey EXIST but DO NOT USE on 3.x (keys unsafe).
```

### Numeric + RoundingHalfEven (the correct blendedRate idiom)
`Decimal = Numeric 10`. RoundingMode enum: `RoundingUp, RoundingDown, RoundingCeiling, RoundingFloor, RoundingHalfUp, RoundingHalfDown, RoundingHalfEven, RoundingUnnecessary`.
```haskell
import DA.Numeric (div, mul, roundNumeric)
-- Verbatim sigs:
--   div : NumericScale n3 => Numeric n1 -> Numeric n2 -> Numeric n3
--   mul : ...                                          -> Numeric n3
--   roundNumeric : NumericScale n => Int -> RoundingMode -> Numeric n -> Numeric n

-- CORRECT blended-rate: compute, then ROUND EXPLICITLY (mode lives in YOUR code):
blendedRate : Numeric 10 -> Numeric 10 -> Numeric 10
blendedRate weightedSum totalCapacity =
  roundNumeric 10 RoundingHalfEven (weightedSum / totalCapacity)
```
**Critical:** there is **NO `divD` / `mulD`** function taking a RoundingMode. The pin's `divD Numeric 10 RoundingHalfEven` is wrong syntax. Use `(/)`/`div` then `roundNumeric`. Whether `(/)`/`div` round half-to-even is **(UNVERIFIED)** in docs — so always wrap with `roundNumeric` to make rounding deterministic. Note `(/)` and `(*)` require **equal** numeric scales; mixing scales needs `div`/`mul`/`cast`.

### DA.Map (deterministic remaining-capacity tracking)
```haskell
import DA.Map (Map)
import qualified DA.Map as Map
-- Map.empty, Map.insert k v m, Map.lookup k m, Map.adjust f k m, Map.toList m (ordered by key)
caps0 = Map.fromList [(lenderA, 1000.0), (lenderB, 500.0)]
remaining = Map.adjust (\c -> c - amt) lenderA caps0
```

### sortOn (STABLE) + explicit deterministic tie-break
```haskell
import DA.List (sortOn)
-- sortOn : Ord k => (a -> k) -> [a] -> [a]  -- STABLE (keeps input order on ties)
import DA.Internal.Prelude (Down(..))
-- Sort bids best-rate-first; tie-break by contractId so the order is FULLY deterministic
-- regardless of ACS ordering differences between operator and auditor:
ranked = sortOn (\b -> (Down b.rate, b.cid)) bids
```
Stability alone is **not** determinism if the input ACS order can differ — the explicit tie-break (contractId) is mandatory.

### Daml Script + submitMustFail
```haskell
import Daml.Script
-- 3.4 sigs are TYPECLASS-based (do NOT annotate with the 2.x `Party -> Commands a -> Script a`):
--   submit         : (HasCallStack, ScriptSubmit script, IsSubmitOptions options) => options -> Commands a -> script a
--   submitMustFail : (...) => options -> Commands a -> script ()
--   submitMulti    : [Party] -> [Party] -> Commands a -> script a
--   setTime : Time -> Script () ;  passTime (hours 10)
-- A Party IS an IsSubmitOptions instance, so `submit alice $ ...` still works.

nelva_test : Script ()
nelva_test = do
  alice <- allocateParty "Alice"
  bob   <- allocateParty "Bob"
  submitMustFail alice do createCmd Token with owner = bob   -- alice can't create bob's token
  cid <- submit alice do createCmd Token with owner = alice
  _   <- submit alice $ exerciseCmd cid SomeChoice with arg = 1
  ps  <- query @Token alice
  pure ()
-- Commands: createCmd, exerciseCmd cid Choice with ..., exerciseByKeyCmd (avoid), allocateParty,
--           query @Template party, listKnownParties. Run with `dpm test`.
```

---

## 4. THE NELVA DAML MODEL (build spec)

Module conventions: package name `nelva`; templateId form in clients = `#nelva:Nelva.<Module>:<Entity>`.

### 4a. The 10 templates
1. **Holding** — fungible position. Choices: `Lock` (-> locked sub-contract / locked flag), `Transfer`. Funds are **locked at bid time** (no separate escrow trust in the operator).
2. **SealedBid** — `signatory lender`; `observer operator, auditor`. Created with an associated locked Holding (fund-lock-at-bid). Choices: `DrawForMatch` (consumed during matching, propagates the lender's authority into the Loan — see 4c), `WithdrawBid` (lender reclaims locked funds before match).
3. **BorrowIntent** — borrower's demand (amount, maxRate, collateral ref).
4. **CreditScore** — `Tier` enum field; **one per borrower** (enforce single-active in choice logic, NOT via key).
5. **MatchProposal** — deterministic output of a match round. `Accept` is **atomic** and commits `inputBidCids` (including **losers**, so the exact input set is on record). Carries a **deterministic `proposalId`**.
6. **Loan** — `ensure collateral >= required`. Choices: `Repay`, `Liquidate`. Re-check collateral inside `Liquidate`/`Repay` logic (ensure is create-time only).
7. **PriceUpdate** — written by the off-ledger PriceOracle bot.
8. **VerifyRequest** — carries `Verify` (a **nonconsuming** choice that re-runs the pure matcher; see 4d).
9. **AuditBadge** — attestation that operator output == auditor recomputation.
10. **MatchRound** — `RunMatch` choice (operator-driven); **one open MatchRound** at a time (single-active in logic).

### 4b. The pure `runDeterministicMatch` module (ONE shared function)
A **pure** module (no ledger effects) imported by BOTH `MatchRound.RunMatch` and `VerifyRequest.Verify`:
- `sortOn (\b -> (Down b.rate, b.cid)) bids` — best-rate first, contractId tie-break.
- track remaining capacity per lender in a **`DA.Map`**.
- `blendedRate = roundNumeric 10 RoundingHalfEven (weightedSum / totalCapacity)`.
- **reject** any bid whose rate `> maxRate`; apply discriminatory price ticks deterministically.
- output a stable, fully-ordered `[Match]` + the full input set (winners + losers).

Because it is pure and total, operator and auditor get identical bytes from identical inputs.

### 4c. Multi-party auth via DrawForMatch (no god-mode)
Per the authorization model: *the consequences of an exercise are authorized by the actors of the action PLUS the signatories of the contract on which the action was taken.* So when `RunMatch` exercises `DrawForMatch` on each winning **SealedBid** (signatory = lender), the **lender's authority flows into** the `create Loan`. The operator therefore needs **no extra authority** to mint the Loan. Authority is **non-transitive** — each nested exercise needs its own controllers' authority, so structure the tree so every Loan is created under the relevant SealedBid's signature.

### 4d. Determinism rules (mandatory)
- Sort key = `(Down rate, contractId)` — never rely on ACS ordering.
- All division wrapped in `roundNumeric 10 RoundingHalfEven`.
- No wall-clock / no `getTime`-dependent branching inside the pure matcher.
- `proposalId` derived deterministically from the (sorted) input set, not from a counter or timestamp.
- Loser bids included in `inputBidCids` so the audited input is reproducible.

### 4e. Golden-vector test (MANDATORY, runs under `dpm test`)
A Daml Script that: sets up a fixed bid set, has the operator run `RunMatch`, has the auditor run `Verify`, and asserts the two outputs are **byte-for-byte identical** (same matches, same blendedRate, same proposalId, same ordering). This is the core anti-fraud guarantee.

---

## 5. DO-NOT / ANTI-HALLUCINATION LIST

- **Do NOT use the `daml` assistant** (`daml build`/`daml test`/`daml start`/`daml studio`) — REMOVED in SDK 3.5. Use `dpm ...`. Translate every `daml ` from old tutorials to `dpm `.
- **Do NOT invent `divD`/`mulD`** with a RoundingMode arg — no such function. Use `(/)`/`div` then `roundNumeric 10 RoundingHalfEven`.
- **Do NOT assume `(/)`/`div` round half-to-even (UNVERIFIED)** — make rounding explicit.
- **Do NOT use contract keys for uniqueness or existence** — docs.digitalasset.com/build/3.5 says contract keys are **NOT supported in this release of Canton 3.x**. No `key`/`maintainer`/`fetchByKey`/`exerciseByKey`/`lookupByKey`/`DA.ContractKeys` as a correctness mechanism. Enforce single-active invariants (one CreditScore/borrower, one open MatchRound, no duplicate Holding-lock) in **choice logic / off-ledger client**.
- **Do NOT annotate Script tests with the 2.x `submit : Party -> Commands a -> Script a`** — 3.4 is typeclass-based (`IsSubmitOptions`/`ScriptSubmit`).
- **Do NOT compute hashes on-ledger.** `DA.Crypto.Text` `sha256`/`keccak256`/`secp256k1` are **ALPHA** in 3.x with `BytesHex -> BytesHex` signatures; only compile behind `-Wno-crypto-text-is-alpha`. Compute hashes **off-ledger** (Node/JVM) and pass them in.
- **Do NOT use field-level privacy** inside one template — it does not exist. Split sensitive legs into separate contracts; rely on sub-transaction projection.
- **Do NOT give the operator god-mode authority** — use signatory-propagation via `DrawForMatch`.
- **Do NOT expect authority to chain transitively** through nested exercises.
- **Do NOT put template-local `let` in the `where` block** (deprecated since 2.8).
- **Do NOT use Daml Triggers** for event loops — deprecated/2.x-only. (BE uses gRPC UpdateService stream / PQS polling.)
- **Do NOT use `@daml/ledger` or `@daml/react`** (frozen at 2.10.4 = JSON API v1, dead on Canton 3.x) for any client.
- **Do NOT trust Splice/Scan to serve custom Nelva contracts** — Scan serves only Amulet/network data; build your own read service (BE).
- **Daml Enterprise license caveat:** cn-quickstart runtime DARs + PQS/Scribe are **Enterprise** — a license may be required **even on LocalNet**. Verify day-1.
- **Do NOT install `@daml/types@3.6.0-snapshot.*`** — stable latest is 3.5.2.

---

## 6. GOTCHAS

- `ensure` is a **create-time precondition**, not a cross-choice invariant — `Loan`'s `ensure collateral >= required` blocks creating an under-collateralized Loan, but you must re-check in `Liquidate`/`Repay`.
- Forgetting **`nonconsuming`** on `Verify` (or any re-runnable/queryable choice) silently **archives** the contract.
- `sortOn` is stable, but **stability ≠ determinism** if ACS input order can vary — always append the contractId tie-break.
- `(/)`/`(*)` force equal scales; mixing scales needs `div`/`mul`/`cast`.
- Multiple controllers => **all** their authority is needed; design choice controllers accordingly.
- LocalNet needs ~16 GB under WSL2 (README's 8 GB is too low) — set `.wslconfig`.
- JDK: install **21** (satisfies both dpm's "17+" and cn-quickstart's 21).
- Pin cn-quickstart via **main + `.env`**, not git tags.
- Run `make clean-all` before rebuilding old cn-quickstart checkouts (post-2025-07-02 architecture change).

---

## 7. AUTHORITATIVE DOC LINKS + Canton MCP

**Canonical docs:** https://docs.canton.network/ — use **https://docs.canton.network/llms.txt** as the machine-readable index (site search is unreliable). Legacy mirror docs.digitalasset.com/build/3.4 and /3.5 banners users back to canton.network; cross-check both (DPM/version reference pages currently render more fully on the legacy mirror).

Key pages:
- Daml language reference (template/choice/signatory/observer/ensure/consuming).
- Authorization module (`m3-authorization` — signatory-propagation, non-transitive authority).
- DA.Numeric / DA.List standard-library reference (RoundingMode, sortOn stability).
- Contract keys (build/3.5: "not supported in this release of Canton 3.x").
- Daml.Script API (3.4 typeclass `submit`/`submitMustFail`).
- DPM reference: docs.digitalasset.com/build/3.4/dpm/dpm.html.
- LocalNet: `m5-localnet-development` / appdev quickstart.

**Canton MCP (docs/deprecation sanity-check, advisory only).** Package `@canton-network-devs/canton-mcp-server` (npm latest **2.2.1**). It serves curated, auto-updating Canton docs/version/deprecation knowledge to the AI — it does **not** build, query a ledger, or run dpm. Best tool for this skill's goal: **`canton_check`** (confirm a package/command isn't deprecated before using it); also `canton_api_ref`, `canton_lookup`.
```bash
# Claude Code / Agent SDK (NOT in the README; derived from the verified mcpServers shape):
claude mcp add canton-dev -- npx -y @canton-network-devs/canton-mcp-server
# equivalent .mcp.json:
# {"mcpServers":{"canton-dev":{"command":"npx","args":["-y","@canton-network-devs/canton-mcp-server"]}}}
```
The installer's `npx @canton-network-devs/canton-mcp-server install` only writes **Claude Desktop** config — it does NOT wire up Claude Code. The MCP's version pins **lag ours** (it says SDK 3.4 / Splice 0.5.0 / JDK 17+) — treat as **advisory**; trust this skill's pins (3.4.11 / Splice 0.5.3 / PQS 0.6.15 / JDK 21). Its suggested FE replacements `@c7/ledger`/`@c7/react` are **(UNVERIFIED)** here — do not adopt blindly.

> **Always:** flag deprecation with the MCP, then verify against `docs.canton.network/llms.txt` before acting.
