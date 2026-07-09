import type { IconType } from "react-icons";
import {
  FiAward,
  FiChevronRight,
  FiKey,
  FiLock,
  FiShield,
  FiSliders,
} from "react-icons/fi";

type Capability = {
  icon: IconType;
  title: string;
  body: string;
  href: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: FiLock,
    title: "Sealed bids",
    body: "Your max rate is sealed - only the matching engine sees it, never rival lenders or borrowers. Canton privacy, not encryption.",
    href: "#security",
  },
  {
    icon: FiSliders,
    title: "Deterministic matching",
    body: "Cheapest lender first, on-ledger. The same inputs always give the same result, so honest bidding is the best strategy.",
    href: "#how",
  },
  {
    icon: FiShield,
    title: "Auditable matching",
    body: "An independent auditor re-runs the exact match on-ledger and flips a GREEN or RED badge - proving it was not rigged.",
    href: "#how",
  },
  {
    icon: FiAward,
    title: "Credit tiers",
    body: "Repay to rank up and unlock cheaper collateral, from 2.0x at Bronze down to 1.2x at Platinum.",
    href: "#tiers",
  },
  {
    icon: FiKey,
    title: "Non-custodial",
    body: "Sign with your own key via a real Canton wallet. Nelva never holds your funds.",
    href: "#security",
  },
];

export function Capabilities() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <h2 className="font-heading text-4xl font-bold leading-tight text-lp-text sm:text-5xl">
            Our
            <br />
            Capabilities
          </h2>
          <p className="mt-5 max-w-sm font-body text-base leading-7 text-lp-muted">
            We built Nelva so a private market can also be a provable one. Here
            is what that unlocks.
          </p>
        </div>

        <div className="flex flex-col">
          {CAPABILITIES.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`flex gap-5 py-7 ${
                  index > 0 ? "border-t border-lp-border" : ""
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lp-surface text-lp-text">
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="font-heading text-xl font-semibold text-lp-text">
                    {item.title}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-6 text-lp-muted">
                    {item.body}
                  </p>
                  <a
                    href={item.href}
                    className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-medium text-lp-text transition-opacity hover:opacity-70"
                  >
                    Read more
                    <FiChevronRight size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
