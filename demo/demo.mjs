#!/usr/bin/env node
// NELVA — OPERATOR DEMO (terminal)
//
// The demo controls that used to live in the app's Lens tab, moved to a script so the
// product UI stays clean. This drives the OPERATOR side of the story; the independent
// auditor stays its own script (auditor/audit.mjs) — run them side by side:
//
//   node demo/demo.mjs match            # operator publishes an HONEST deterministic match
//   node demo/demo.mjs cheat            # operator publishes a DISHONEST match (demo villain)
//   node demo/demo.mjs lens [proposal]  # one ledger, five perspectives — who sees what
//   node demo/demo.mjs status           # public outsider view (aggregates only)
//
//   then:  node auditor/audit.mjs       # GREEN for the honest match, RED for the cheat
//
// Config: NELVA_BE overrides the backend URL (default = the deployed Railway gateway).

const BE = process.env.NELVA_BE || "https://nelva-production.up.railway.app";
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m", c: "\x1b[36m" };

async function api(path, { method = "GET", party } = {}) {
  const r = await fetch(BE + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(party ? { Authorization: `Bearer ${party}` } : {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `${path} -> ${r.status}`);
  return j;
}

const pct = (x) => `${(Number(x) * 100).toFixed(2)}%`;
const amt = (x) => Number(x).toLocaleString();

function printProposals(proposals, tone) {
  for (const p of proposals ?? []) {
    console.log(`  ${tone}proposal${C.x} ${C.b}${p.proposalId.slice(0, 10)}…${C.x}  principal ${C.b}${amt(p.principal)}${C.x}  blended ${C.b}${pct(p.blendedRate)}${C.x}  (${p.tier})`);
    for (const t of p.ticks ?? []) console.log(`    ${C.d}└─ ${t.lender}: ${amt(t.amount)} @ ${pct(t.rate)}${C.x}`);
  }
}

const CMDS = {
  // operator publishes the honest deterministic match (same thing the auto-matcher runs)
  async match() {
    console.log(`${C.b}${C.c}OPERATOR · RUN MATCH${C.x} ${C.d}(deterministic, cheapest-first, on-ledger)${C.x}\n`);
    const r = await api("/admin/run-match", { method: "POST", party: "Operator" });
    if (!r.proposals?.length) return console.log(`  ${C.y}no matchable bids/borrows right now — post a bid + a borrow first${C.x}`);
    printProposals(r.proposals, C.g);
    console.log(`\n  ${C.d}verify it:${C.x}  node auditor/audit.mjs   ${C.d}→ expect${C.x} ${C.g}${C.b}GREEN${C.x}`);
  },
  // operator publishes a deliberately DISHONEST match — the demo villain
  async cheat() {
    console.log(`${C.b}${C.r}OPERATOR · CHEAT MATCH${C.x} ${C.d}(fills priciest-first, skips cheap lenders — skims the borrower)${C.x}\n`);
    const r = await api("/admin/cheat-match", { method: "POST", party: "Operator" });
    if (!r.proposals?.length) {
      console.log(`  ${C.y}nothing to cheat on — no OPEN borrow intent right now.${C.x}`);
      console.log(`  ${C.d}the cheat match needs a live, not-yet-accepted borrow. In the app: submit a Borrow,`);
      console.log(`  wait for its honest proposal to appear, THEN run cheat (don't Accept the honest one first).${C.x}`);
      return;
    }
    printProposals(r.proposals, C.r);
    console.log(`\n  two independent defenses now fire:`);
    console.log(`   1. ${C.b}auditor${C.x}   node auditor/audit.mjs        ${C.d}→${C.x} ${C.r}${C.b}RED${C.x} ${C.d}(on-ledger AuditBadge)${C.x}`);
    console.log(`   2. ${C.b}settle${C.x}    borrower clicks Accept in-app ${C.d}→${C.x} ${C.r}ledger REFUSES to settle${C.x} ${C.d}(Accept re-runs the match)${C.x}`);
  },
  // one ledger, five perspectives — the per-party projections, straight from the ledger
  async lens(proposalCid) {
    let pid = proposalCid;
    if (!pid) {
      const props = await api("/proposals", { party: "Operator" });
      pid = props.find((p) => p.status === "PENDING")?.proposalId ?? props[0]?.proposalId;
      if (!pid) return console.log(`  ${C.y}no proposals to inspect — run:  node demo/demo.mjs match${C.x}`);
    }
    const v = await api(`/lens?proposalId=${encodeURIComponent(pid)}`, { party: "Operator" });
    const P = v.perspectives;
    console.log(`${C.b}${C.c}ONE LEDGER · FIVE PERSPECTIVES${C.x}  ${C.d}proposal ${pid.slice(0, 10)}… — each view is a real per-party ledger read${C.x}\n`);
    console.log(`  ${C.b}LENDER${C.x}    sees ${C.d}only its own bid:${C.x}     ${(P.lender?.bids ?? []).map((b) => `${amt(b.amount)} @ ${pct(b.rate)}`).join(", ") || "—"}`);
    console.log(`  ${C.b}BORROWER${C.x}  sees ${C.d}only its own loan:${C.x}    ${P.borrower?.proposal ? `${amt(P.borrower.proposal.principal)} @ blended ${pct(P.borrower.proposal.blendedRate)}` : "—"}`);
    console.log(`  ${C.b}OPERATOR${C.x}  sees ${C.d}ALL rates (matches):${C.x}  ${(P.operator?.bids ?? []).map((b) => `${b.lender} ${amt(b.amount)} @ ${pct(b.rate)}`).join(", ") || "—"}`);
    console.log(`  ${C.b}AUDITOR${C.x}   sees ${C.d}ALL rates (verifies):${C.x} ${(P.auditor?.bids ?? []).length} bids · badge: ${P.auditor?.badge ? (P.auditor.badge.verdict === "GREEN" ? `${C.g}${C.b}GREEN ✔${C.x}` : `${C.r}${C.b}RED ✘${C.x}`) : `${C.d}none yet — run the auditor${C.x}`}`);
    console.log(`  ${C.b}OUTSIDER${C.x}  sees ${C.d}aggregates only:${C.x}      ${P.outsider.status.openBids} open bids · ${P.outsider.status.activeLoans} active loans ${C.d}(no rates, no identities)${C.x}`);
    console.log(`\n  ${C.d}this scoping is Canton's per-party projection — the excluded parties' nodes never RECEIVE the data.${C.x}`);
  },
  // what the public sees: totals only
  async status() {
    const s = await api("/status");
    console.log(`${C.b}${C.c}PUBLIC (OUTSIDER) VIEW${C.x}\n`);
    console.log(`  open bids ${C.b}${s.openBids}${C.x} · pending proposals ${C.b}${s.proposals}${C.x} · active loans ${C.b}${s.activeLoans}${C.x}`);
    console.log(`  ${C.d}no rates, no identities, no amounts per party — privacy holds outside the deal.${C.x}`);
  },
};

const [cmd = "status", arg] = process.argv.slice(2);
if (!CMDS[cmd]) {
  console.log(`usage: node demo/demo.mjs ${Object.keys(CMDS).join(" | ")}`);
  process.exit(1);
}
console.log(`${C.d}backend ${BE}${C.x}\n`);
CMDS[cmd](arg).catch((e) => { console.error(`${C.r}demo failed:${C.x}`, e.message); process.exit(1); });
