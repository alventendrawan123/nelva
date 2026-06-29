export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

export function parseRatePercent(percent: string): number {
  return Number(percent) / 100;
}

export function formatAmount(amount: number, symbol = "nUSD"): string {
  return `${amount.toLocaleString("en-US")} ${symbol}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
