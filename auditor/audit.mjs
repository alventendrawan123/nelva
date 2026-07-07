#!/usr/bin/env node
// NELVA — INDEPENDENT AUDITOR (terminal)
//
// Runs OUTSIDE the operator's app/server. Connects straight to the Canton ledger as the
// auditor party, re-runs the deterministic match ON-LEDGER (the Daml VerifyRequest.Verify
// choice), and prints GREEN (published == honest recompute) or RED (operator fabricated).
// No operator backend is involved — that is the whole point: the auditor is its own process.
//
//   Usage:  node auditor/audit.mjs [proposalCid]
//     - no arg  -> verify every currently-verifiable pending proposal
//     - arg     -> verify just that proposal
//
// Config comes from the same env the backend uses (JSON_LEDGER_API, AUTH_*, NELVA_*).

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m", c: "\x1b[36m" };

const LEDGER = process.env.JSON_LEDGER_API || "https://ledger-api.validator.devnet.sandbox.fivenorth.io";
const NS = process.env.NELVA_NAMESPACE || "1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8";
const PREFIX = process.env.NELVA_PARTY_PREFIX || "nelva-";
const ENV_PKG = process.env.NELVA_PACKAGE_ID?.trim();
const PKG = ENV_PKG && /^[0-9a-f]{64}$/.test(ENV_PKG) ? ENV_PKG : "27da556acd65944ceb385c82fa94c3a64551b9bb263ad4668eaa55e9ba8e21c9";
const AUDITOR = `${PREFIX}Auditor::${NS}`;
const OPERATOR = `${PREFIX}Operator::${NS}`;
const tid = (s) => `${PKG}:Nelva.${s}`;

let _tok, _uid, _seq = 0;
const nid = (p) => `${p}-${Date.now().toString(36)}-${++_seq}`;

async function token() {
  if (_tok) return _tok;
  const r = await fetch(process.env.AUTH_TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials", client_id: process.env.AUTH_CLIENT_ID,
      client_secret: process.env.AUTH_CLIENT_SECRET, audience: process.env.AUTH_AUDIENCE,
      scope: process.env.AUTH_SCOPE || "daml_ledger_api",
    }),
  });
  if (!r.ok) throw new Error(`auth ${r.status}: ${await r.text()}`);
  _tok = (await r.json()).access_token;
  _uid = JSON.parse(Buffer.from(_tok.split(".")[1], "base64url").toString()).sub; // ledger userId = token sub
  return _tok;
}
async function api(path, body) {
  const t = await token();
  const opt = { headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } };
  if (body !== undefined) { opt.method = "POST"; opt.body = JSON.stringify(body); }
  const r = await fetch(LEDGER + path, opt);
  const txt = await r.text();
  if (!r.ok) { const e = new Error(`${path} -> ${r.status} ${txt.slice(0, 200)}`); e.status = r.status; throw e; }
  return txt ? JSON.parse(txt) : {};
}
// created contracts inside a submit's transaction tree (same shape the BE parses)
function made(tree, suffix) {
  const out = [];
  for (const ev of Object.values(tree?.eventsById ?? {})) {
    const v = ev.CreatedTreeEvent?.value;
    if (v && String(v.templateId).endsWith("Nelva." + suffix)) out.push({ cid: v.contractId, arg: v.createArgument });
  }
  return out;
}
async function submit(command) {
  await token();
  const r = await api("/v2/commands/submit-and-wait-for-transaction-tree",
    { commands: [command], commandId: nid("audit"), userId: _uid, actAs: [AUDITOR] });
  return r.transactionTree;
}

async function activeProposals() {
  const end = (await api("/v2/state/ledger-end")).offset;
  const arr = await api("/v2/state/active-contracts",
    { activeAtOffset: end, eventFormat: { filtersByParty: { [OPERATOR]: {} }, verbose: true } });
  const rows = arr.map((e) => e?.contractEntry?.JsActiveContract?.createdEvent).filter(Boolean);
  const live = new Set(rows.map((c) => c.contractId));
  // this package's proposals only (an SC upgrade leaves the old package's proposals on-ledger too)
  const props = rows.filter((c) => String(c.templateId) === tid("Settlement:MatchProposal"));
  return props.map((p) => {
    const a = p.createArgument;
    const refsLive = live.has(a.borrowCid) && (a.inputBidCids ?? []).every((c) => live.has(c));
    return { cid: p.contractId, arg: a, refsLive };
  });
}

// Re-run the match on-ledger for ONE proposal: create a VerifyRequest as the auditor, then
// exercise Verify. The Daml choice re-fetches the committed bids + borrow and recomputes the
// deterministic match, returning an auditor-signed AuditBadge (verdict True=GREEN / False=RED).
async function verify(proposalCid) {
  const vr = made(await submit({ CreateCommand: { templateId: tid("Settlement:VerifyRequest"), createArguments: { auditor: AUDITOR } } }), "Settlement:VerifyRequest")[0];
  const tree = await submit({ ExerciseCommand: { templateId: tid("Settlement:VerifyRequest"), contractId: vr.cid, choice: "Verify", choiceArgument: { proposalCid } } });
  const badge = made(tree, "Settlement:AuditBadge")[0];
  return badge.arg.verdict === true || badge.arg.verdict === "true";
}

const pct = (r) => `${(Number(r) * 100).toFixed(2)}%`;
const short = (c) => `${c.slice(0, 8)}…${c.slice(-4)}`;

(async () => {
  console.log(`${C.b}${C.c}
  ╔══════════════════════════════════════════════════════════════╗
  ║   NELVA · INDEPENDENT AUDITOR — on-ledger match verification  ║
  ╚══════════════════════════════════════════════════════════════╝${C.x}`);
  console.log(`  ${C.d}ledger  ${C.x}${LEDGER}`);
  console.log(`  ${C.d}auditor ${C.x}${AUDITOR}`);
  console.log(`  ${C.d}package ${C.x}${PKG}\n`);

  const only = process.argv[2];
  let targets = await activeProposals();
  if (only) targets = targets.filter((p) => p.cid === only || p.cid.startsWith(only));
  const verifiable = targets.filter((p) => p.refsLive);
  const skipped = targets.length - verifiable.length;

  if (!verifiable.length) {
    console.log(`  ${C.y}no verifiable pending proposals right now${C.x}`);
    if (skipped) console.log(`  ${C.d}(${skipped} skipped — reference archived contracts)${C.x}`);
    return;
  }
  console.log(`  re-running the deterministic match over ${C.b}${verifiable.length}${C.x} proposal(s), on-ledger…\n`);

  let green = 0, red = 0, err = 0;
  for (const p of verifiable) {
    const a = p.arg;
    const head = `  ${C.b}${short(p.cid)}${C.x}  ${C.d}${a.tier}${C.x}  principal ${C.b}${Number(a.principal)}${C.x}  published blended ${C.b}${pct(a.blendedRate)}${C.x}`;
    try {
      const ok = await verify(p.cid);
      if (ok) { green++; console.log(`${head}\n     └─ ${C.g}${C.b}GREEN ✔${C.x}${C.g}  recomputed match == published (honest)${C.x}\n`); }
      else { red++; console.log(`${head}\n     └─ ${C.r}${C.b}RED ✘${C.x}${C.r}  recompute DIVERGES from published (operator fabricated)${C.x}\n`); }
    } catch (e) {
      err++; console.log(`${head}\n     └─ ${C.y}⚠ could not verify${C.x} ${C.d}${String(e.message).slice(0, 80)}${C.x}\n`);
    }
  }
  console.log(`  ${C.b}result${C.x}  ${C.g}${green} GREEN${C.x} · ${C.r}${red} RED${C.x}` +
    (err ? ` · ${C.y}${err} error${C.x}` : "") + (skipped ? ` · ${C.d}${skipped} skipped${C.x}` : ""));
  console.log(`  ${C.d}each verdict is an on-ledger, auditor-signed AuditBadge — not a claim by the operator's server.${C.x}\n`);
})().catch((e) => { console.error(`${C.r}auditor failed:${C.x}`, e.message); process.exit(1); });
