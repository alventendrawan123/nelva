// Cheat-match helper for the demo. The BE's runCheatMatch uses this to build a
// deliberately DISHONEST proposal (priciest-first, skipping cheaper lends) so the
// auditor's on-ledger Verify flags it RED. The HONEST match runs on-ledger
// (Daml Nelva.Settlement:RunMatch), not here.
import type { Tick } from "./types.js";

export interface BidInput { bidId: string; lender: string; amount: number; rate: number }
interface BorrowInput { borrowId: string; borrower: string; amount: number; maxRate: number }
interface Fill { borrowId: string; borrower: string; principal: number; blendedRate: number; ticks: Tick[] }

// emulate Daml Numeric 10
const round10 = (x: number) => Math.round(x * 1e10) / 1e10;
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

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
