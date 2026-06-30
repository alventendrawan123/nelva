import Image from "next/image";
import Link from "next/link";
import { ConnectWallet } from "@/components/layout/ConnectWallet";
import { NavLinks } from "@/components/layout/NavLinks";
import { PersonaSwitcher } from "@/components/layout/PersonaSwitcher";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/images/logo/nelva-logo.png"
              alt="Nelva"
              width={32}
              height={32}
              priority
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              NELVA
            </span>
          </Link>
          <NavLinks />
        </div>

        <div className="flex items-center gap-3">
          <PersonaSwitcher />
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
