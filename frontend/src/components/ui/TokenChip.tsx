import { ChevronDown } from "lucide-react";
import Image from "next/image";

type TokenChipProps = {
  symbol: string;
  showChevron?: boolean;
};

const TOKEN_ICON: Record<string, string> = {
  nUSD: "/assets/images/logo/usdc-logo.svg",
  COLL: "/assets/images/logo/nelva-logo.png",
};

export function TokenChip({ symbol, showChevron = true }: TokenChipProps) {
  const iconSrc = TOKEN_ICON[symbol] ?? "/assets/images/logo/nelva-logo.png";
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-3 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-2"
    >
      <Image
        src={iconSrc}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-full"
      />
      {symbol}
      {showChevron ? <ChevronDown className="h-4 w-4 text-muted" /> : null}
    </button>
  );
}
