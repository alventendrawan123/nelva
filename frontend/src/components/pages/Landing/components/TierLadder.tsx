"use client";

import { motion } from "framer-motion";
import { FiAward, FiCheck, FiTrendingUp } from "react-icons/fi";
import { bentoItem } from "./motion";
import { SectionTitle } from "./SectionTitle";

type Tier = {
  n: string;
  label: string;
  name: string;
  tagline: string;
  multiplier: string;
  collateral: string;
  perks: string[];
  text: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    n: "01",
    label: "Starting tier",
    name: "Bronze",
    tagline: "Where every borrower begins",
    multiplier: "2.0x",
    collateral: "200 to borrow 100 nUSD",
    text: "text-lp-text",
    perks: [
      "2.0x collateral multiplier",
      "Open to every new borrower",
      "Repay once to reach Silver",
    ],
  },
  {
    n: "02",
    label: "Repay 1x",
    name: "Silver",
    tagline: "Your first rank up",
    multiplier: "1.8x",
    collateral: "180 to borrow 100 nUSD",
    text: "text-lp-text",
    perks: [
      "1.8x collateral multiplier",
      "Unlocked after 1 repay",
      "Less capital locked per loan",
    ],
  },
  {
    n: "03",
    label: "Repay 2x",
    name: "Gold",
    tagline: "Proven track record",
    multiplier: "1.5x",
    collateral: "150 to borrow 100 nUSD",
    text: "text-lp-text",
    perks: [
      "1.5x collateral multiplier",
      "Unlocked after 2 repays",
      "Stronger on-chain reputation",
    ],
  },
  {
    n: "04",
    label: "Repay 3x",
    name: "Platinum",
    tagline: "Maximum capital efficiency",
    multiplier: "1.2x",
    collateral: "120 to borrow 100 nUSD",
    text: "text-lp-text",
    featured: true,
    perks: [
      "1.2x collateral - the lowest",
      "Unlocked after 3 repays",
      "Best capital efficiency",
      "Top of the ladder",
    ],
  },
];

const viewport = { once: true, margin: "-60px" } as const;

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const inner = (
    <div className="flex h-full flex-col rounded-[22px] bg-lp-surface p-6">
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lp-surface-2 text-lp-text">
          <FiAward size={22} />
        </span>
        {tier.featured ? (
          <span className="rounded-full bg-lp-accent px-2.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-lp-accent-foreground">
            Top tier
          </span>
        ) : null}
      </div>

      <span className="mt-4 font-body text-xs font-semibold text-lp-muted">
        {tier.n} {tier.label}
      </span>
      <p className={`mt-2 font-heading text-3xl font-bold ${tier.text}`}>
        {tier.name}
      </p>
      <p className="mt-1 font-body text-sm text-lp-muted">{tier.tagline}</p>

      <div className="mt-5">
        <p className="font-heading text-3xl font-bold text-lp-text">
          {tier.multiplier}
          <span className="ml-1 font-body text-sm font-medium text-lp-muted">
            collateral
          </span>
        </p>
        <p className="mt-1 font-body text-xs text-lp-muted">
          {tier.collateral}
        </p>
      </div>

      <div className="my-5 h-px bg-lp-border" />

      <ul className="flex flex-col gap-3">
        {tier.perks.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2 font-body text-sm text-lp-text"
          >
            <FiCheck size={16} className="mt-0.5 shrink-0 text-lp-accent" />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <motion.div
      variants={bentoItem}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      custom={index}
      whileHover={{ y: -6 }}
      className={
        tier.featured
          ? "rounded-3xl bg-gradient-to-b from-white/40 via-lp-border to-lp-border p-[1.5px] lg:-mt-3"
          : "rounded-3xl border border-lp-border bg-lp-surface p-[1px]"
      }
    >
      {inner}
    </motion.div>
  );
}

export function TierLadder() {
  return (
    <section
      id="tiers"
      className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24"
    >
      <SectionTitle
        eyebrow="Credit tiers"
        title="Repay to rank up, lock less collateral"
        subtitle="Your on-chain reputation is a ladder. Every loan you repay ranks you up, and every rank drops the collateral you must lock - from 2.0x at Bronze to 1.2x at Platinum."
      />

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier, index) => (
          <TierCard key={tier.name} tier={tier} index={index} />
        ))}
      </div>

      <p className="mt-10 flex items-center justify-center gap-2 font-body text-sm text-lp-muted">
        <FiTrendingUp size={16} className="text-lp-accent" />
        Repay on time to keep ranking up. A default or liquidation ranks you
        back down.
      </p>
    </section>
  );
}
