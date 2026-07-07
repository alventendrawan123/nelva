# Nelva — Independent Auditor (terminal)

The auditor is **not** a button in the operator's app. It is its own process, run from a
terminal by a party the operator does not control. It connects straight to the Canton ledger
as the `Auditor` party, re-runs the deterministic match **on-ledger** (the Daml
`Settlement.VerifyRequest.Verify` choice re-fetches the committed bids + borrow and recomputes
the match), and prints a verdict backed by an auditor-signed on-ledger `AuditBadge`:

- **GREEN** — the operator's published match equals the honest deterministic recompute.
- **RED** — the published match diverges (e.g. a higher blended rate than the cheapest-first
  match would give): the operator fabricated it. The auditor catches it without ever trusting
  the operator's server.

Running the audit from a separate terminal (rather than the operator's UI) is deliberate:
one person clicking both "Run Match" and "Verify" in the same app reads as ambiguous. A
standalone auditor process makes the independence obvious.

## Run

Point it at the ledger with the same env the backend uses:

```bash
# from repo root, with the DevNet env loaded (JSON_LEDGER_API, AUTH_*, NELVA_*)
node auditor/audit.mjs              # verify every currently-verifiable pending proposal
node auditor/audit.mjs <proposalCid>   # verify just one
```

Env it reads (all optional except auth): `JSON_LEDGER_API`, `AUTH_TOKEN_URL`,
`AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_AUDIENCE`, `AUTH_SCOPE`, `NELVA_PACKAGE_ID`
(64-hex, else falls back to the vetted id), `NELVA_NAMESPACE`, `NELVA_PARTY_PREFIX`.

## What it proves

The verdict is computed by a Daml choice that Canton executes deterministically over the real
committed contracts — not by this script and not by the operator's backend. The script only
triggers it and reads the signed badge. GREEN/RED is as trustworthy as the ledger itself.

> Scope note: this is **detect-after** (the auditor attests fairness after the fact). To make
> unfair matches impossible-by-construction, `MatchProposal.Accept` would re-validate the match
> and reject a divergent proposal — then a fabricated match could never settle at all.
