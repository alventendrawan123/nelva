import { WALLET_ADDRESS } from "@/config/nav";

export function WalletPill() {
  return (
    <span className="rounded-full bg-wallet px-4 py-2 text-sm font-semibold text-wallet-foreground">
      {WALLET_ADDRESS}
    </span>
  );
}
