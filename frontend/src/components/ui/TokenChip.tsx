import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";

type TokenChipProps = {
  symbol: string;
  showChevron?: boolean;
};

export function TokenChip({ symbol, showChevron = true }: TokenChipProps) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-3 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-2"
    >
      <TokenIcon symbol={symbol} size={28} />
      {symbol}
      {showChevron ? <ChevronDown className="h-4 w-4 text-muted" /> : null}
    </button>
  );
}
