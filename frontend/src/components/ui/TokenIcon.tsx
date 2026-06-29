import Image from "next/image";

export const TOKEN_ICON: Record<string, string> = {
  nUSD: "/assets/images/logo/usdc-logo.svg",
  COLL: "/assets/images/logo/nelva-logo.png",
};

type TokenIconProps = {
  symbol: string;
  size?: number;
};

export function TokenIcon({ symbol, size = 36 }: TokenIconProps) {
  const src = TOKEN_ICON[symbol] ?? "/assets/images/logo/nelva-logo.png";
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  );
}
