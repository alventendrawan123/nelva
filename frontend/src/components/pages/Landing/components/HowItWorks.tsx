"use client";

import { motion } from "framer-motion";
import type { IconType } from "react-icons";
import {
  FiCheckCircle,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiSliders,
  FiUser,
} from "react-icons/fi";
import { bentoItem } from "./motion";
import { SectionTitle } from "./SectionTitle";

type Step = {
  n: string;
  icon: IconType;
  title: string;
  body: string;
  chip: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: FiLock,
    title: "Lend",
    chip: "Sealed rate",
    body: "A lender posts a sealed bid - an amount at a secret rate that stays hidden.",
  },
  {
    n: "02",
    icon: FiUser,
    title: "Borrow",
    chip: "Intent + collateral",
    body: "A borrower requests an amount, a max rate, and locks collateral by tier.",
  },
  {
    n: "03",
    icon: FiSliders,
    title: "Match",
    chip: "Auto, every 20s",
    body: "The operator's engine runs the deterministic match automatically and publishes a blended-rate proposal.",
  },
  {
    n: "04",
    icon: FiCheckCircle,
    title: "Accept",
    chip: "Atomic settle",
    body: "Funds and collateral move in one transaction; the ledger re-validates the match.",
  },
  {
    n: "05",
    icon: FiRefreshCw,
    title: "Repay",
    chip: "Rank up",
    body: "Repay principal plus interest; collateral returns and the borrower's tier climbs.",
  },
  {
    n: "06",
    icon: FiShield,
    title: "Verify",
    chip: "GREEN / RED",
    body: "The auditor re-runs the match on-ledger for a public honesty verdict.",
  },
];

const viewport = { once: true, margin: "-60px" } as const;

export function HowItWorks() {
  return (
    <section
      id="how"
      className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24"
    >
      <SectionTitle
        eyebrow="How it works"
        title="From idea to a settled loan"
        subtitle="Everything from posting a rate to proving the match, in six steps."
      />

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.article
              key={item.n}
              variants={bentoItem}
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              custom={index}
              whileHover={{ y: -6 }}
              className="group flex flex-col rounded-3xl border border-lp-border bg-lp-surface p-3 transition-colors hover:border-white/20"
            >
              <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white/12 via-lp-surface-2 to-lp-surface">
                <span className="absolute left-4 top-4 font-body text-xs font-semibold text-lp-muted">
                  {item.n}
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-lp-surface px-4 py-3 transition-transform duration-300 group-hover:scale-105">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lp-accent text-lp-accent-foreground">
                    <Icon size={18} />
                  </span>
                  <span className="font-body text-sm font-medium text-lp-text">
                    {item.chip}
                  </span>
                </div>
              </div>
              <div className="px-3 pb-3 pt-5">
                <h3 className="font-heading text-lg font-bold text-lp-text">
                  {item.title}
                </h3>
                <p className="mt-2 font-body text-sm leading-6 text-lp-muted">
                  {item.body}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
