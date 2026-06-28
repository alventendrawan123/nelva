// TypeScript mirror of daml/Nelva/Match.daml — the deterministic sealed-bid matcher.
// MUST stay behaviourally identical to the Daml so the auditor verdicts agree.
import type { Tick } from "./types.js";

export interface BidInput { bidId: string; lender: string; amount: number; rate: number }
export interface BorrowInput { borrowId: string; borrower: string; amount: number; maxRate: number }
export interface Fill { borrowId: string; borrower: string; principal: number; blendedRate: number; ticks: Tick[] }

// emulate Daml Numeric 10
const round10 = (x: number) => Math.round(x * 1e10) / 1e10;
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function runDeterministicMatch(bids: BidInput[], borrows: BorrowInput[]): Fill[] {
  // canonical orderings (tie-broken by id) — order-independent like the Daml
  const bidsSorted = [...bids].sort((a, b) => a.rate - b.rate || cmpStr(a.bidId, b.bidId));
  const borrowsSorted = [...borrows].sort((a, b) => b.amount - a.amount || cmpStr(a.borrowId, b.borrowId));
  const remaining = new Map(bids.map((b) => [b.bidId, b.amount]));
  const fills: Fill[] = [];

  for (const bor of borrowsSorted) {
    let filled = 0;
    let weighted = 0;
    const ticks: Tick[] = [];
    const consumed: Array<[string, number]> = [];
    for (const bid of bidsSorted) {
      if (filled >= bor.amount) break;
      const avail = remaining.get(bid.bidId) ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, bor.amount - filled);
      if (take <= 0) continue;
      remaining.set(bid.bidId, avail - take);
      consumed.push([bid.bidId, take]);
      ticks.push({ lender: bid.lender, bidId: bid.bidId, amount: take, rate: bid.rate });
      filled += take;
      weighted += take * bid.rate;
    }
    if (filled <= 0) continue;
    const blended = round10(weighted / filled);
    if (blended > bor.maxRate) {
      // reject + rollback this borrow's consumption
      for (const [id, amt] of consumed) remaining.set(id, (remaining.get(id) ?? 0) + amt);
      continue;
    }
    fills.push({ borrowId: bor.borrowId, borrower: bor.borrower, principal: filled, blendedRate: blended, ticks });
  }
  return fills;
}

// Auditor re-verification: recompute and compare to the published match.
export function verifyMatch(
  inputBids: BidInput[],
  borrow: BorrowInput,
  publishedTicks: Tick[],
  publishedBlended: number,
): { verdict: "GREEN" | "RED"; reason: string } {
  const fills = runDeterministicMatch(inputBids, [borrow]);
  const f = fills[0] ?? null;
  const expectedTicks = f ? f.ticks : [];
  const sameTicks = JSON.stringify(expectedTicks) === JSON.stringify(publishedTicks);
  const sameBlended = f ? round10(f.blendedRate) === round10(publishedBlended) : publishedTicks.length === 0;
  const ok = sameTicks && sameBlended;
  return {
    verdict: ok ? "GREEN" : "RED",
    reason: ok
      ? "recomputed match equals published (cheapest-first honoured)"
      : "published ticks/blended differ from deterministic recompute — a cheaper lend was skipped or a tick was altered",
  };
}

// A deliberately DISHONEST match for the demo: fills priciest-first (skips cheap lends).
export function cheatMatch(bids: BidInput[], borrows: BorrowInput[]): Fill[] {
  const flipped = [...bids].sort((a, b) => b.rate - a.rate || cmpStr(a.bidId, b.bidId));
  const borrowsSorted = [...borrows].sort((a, b) => b.amount - a.amount);
  const remaining = new Map(bids.map((b) => [b.bidId, b.amount]));
  const fills: Fill[] = [];
  for (const bor of borrowsSorted) {
    let filled = 0;
    let weighted = 0;
    const ticks: Tick[] = [];
    for (const bid of flipped) {
      if (filled >= bor.amount) break;
      const avail = remaining.get(bid.bidId) ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, bor.amount - filled);
      remaining.set(bid.bidId, avail - take);
      ticks.push({ lender: bid.lender, bidId: bid.bidId, amount: take, rate: bid.rate });
      filled += take;
      weighted += take * bid.rate;
    }
    if (filled <= 0) continue;
    fills.push({ borrowId: bor.borrowId, borrower: bor.borrower, principal: filled, blendedRate: round10(weighted / filled), ticks });
  }
  return fills;
}
