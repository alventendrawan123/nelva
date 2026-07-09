import Image from "next/image";
import { FiChevronRight, FiGithub, FiGlobe, FiTwitter } from "react-icons/fi";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "App", href: "/app" },
      { label: "Explore", href: "/explore" },
      { label: "How it works", href: "#how" },
      { label: "Tiers", href: "#tiers" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Security", href: "#security" },
      { label: "FAQ", href: "#faq" },
      { label: "Built on Canton", href: "#security" },
    ],
  },
];

const SOCIALS = [
  {
    icon: FiGithub,
    href: "https://github.com/alventendrawan123/nelva",
    label: "GitHub",
  },
  { icon: FiTwitter, href: "https://x.com", label: "X" },
  { icon: FiGlobe, href: "https://nelva-ashy.vercel.app", label: "Website" },
];

export function LandingFooter() {
  return (
    <footer className="mx-auto max-w-[1280px] px-5 pb-12 sm:px-8">
      <div className="rounded-3xl border border-lp-border bg-lp-surface p-8 sm:p-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="font-heading text-lg font-semibold text-lp-text">
              Enter the private market.
            </p>
            <form
              action="/app"
              className="mt-4 flex max-w-sm items-center gap-2 rounded-full border border-lp-border bg-lp-bg p-1.5 pl-4"
            >
              <input
                type="email"
                required
                placeholder="Your email address"
                aria-label="Email address"
                className="w-full bg-transparent font-body text-sm text-lp-text outline-none placeholder:text-lp-muted"
              />
              <button
                type="submit"
                aria-label="Join"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lp-accent text-lp-accent-foreground"
              >
                <FiChevronRight size={16} />
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-lp-muted">
                  {column.heading}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="font-body text-sm text-lp-text transition-opacity hover:opacity-70"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-lp-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Image
              src="/assets/images/logo/nelva-logo.png"
              alt="Nelva"
              width={34}
              height={34}
            />
            <span className="font-heading text-2xl font-bold text-lp-text">
              Nelva
            </span>
          </a>
          <p className="font-body text-xs text-lp-muted">
            All rights reserved 2026 - Nelva
          </p>
          <div className="flex items-center gap-2">
            {SOCIALS.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-lp-border bg-lp-bg text-lp-text transition-colors hover:bg-lp-surface-2"
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
