import Image from "next/image";

export function LandingLogo({ size = 30 }: { size?: number }) {
  return (
    <a href="/" className="flex items-center gap-2">
      <Image
        src="/assets/images/logo/nelva-logo.png"
        alt="Nelva"
        width={size}
        height={size}
        priority
      />
      <span className="font-heading text-lg font-bold tracking-tight text-lp-text">
        Nelva
      </span>
    </a>
  );
}
