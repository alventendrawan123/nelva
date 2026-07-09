"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  FiActivity,
  FiArrowUpRight,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { bentoItem } from "./motion";
import { SectionTitle } from "./SectionTitle";

const viewport = { once: true, margin: "-60px" } as const;

function Visual({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white/8 via-lp-surface-2 to-lp-surface p-5">
      {children}
    </div>
  );
}

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-lp-surface px-3 py-1.5 font-body text-xs font-medium text-lp-text">
      {icon}
      {label}
    </span>
  );
}

function Card({
  title,
  body,
  visual,
  index,
  className = "",
}: {
  title: string;
  body: string;
  visual: ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={bentoItem}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      custom={index}
      whileHover={{ y: -4 }}
      className={`flex flex-col rounded-3xl border border-lp-border bg-lp-surface p-3 transition-colors hover:border-white/20 ${className}`}
    >
      <Visual>{visual}</Visual>
      <div className="px-3 pb-3 pt-5">
        <h3 className="font-heading text-lg font-bold text-lp-text">{title}</h3>
        <p className="mt-2 font-body text-sm leading-6 text-lp-muted">{body}</p>
      </div>
    </motion.div>
  );
}

export function CollateralSafety() {
  return (
    <section
      id="security"
      className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24"
    >
      <SectionTitle
        eyebrow="Collateral & safety"
        title="Safe by design, not by promise"
        subtitle="Every loan is over-collateralized and every threshold is enforced by the ledger, not by trust in an operator."
      />

      <div className="mt-14 rounded-[32px] border border-lp-border bg-lp-surface-2 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Card
            index={0}
            className="md:col-span-2"
            title="Over-collateralized"
            body="Borrowers lock collateral above the loan value, set by their tier - lenders are always covered."
            visual={
              <div className="flex w-full flex-col items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lp-accent text-lp-accent-foreground">
                  <FiShield size={22} />
                </span>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between font-body text-[11px] text-lp-muted">
                    <span>Loan 100</span>
                    <span>Collateral 150</span>
                  </div>
                  <div className="h-2 rounded-full bg-lp-surface">
                    <div className="h-2 w-2/3 rounded-full bg-lp-accent" />
                  </div>
                </div>
              </div>
            }
          />

          <Card
            index={1}
            className="md:col-span-3"
            title="Liquidation protects lenders"
            body="If collateral drops below the healthy threshold, the loan liquidates: 95% pro-rata to lenders, 5% operator fee, borrower tier down."
            visual={
              <div className="w-full max-w-sm space-y-3">
                <div className="flex overflow-hidden rounded-full">
                  <div className="h-3 w-[95%] bg-lp-accent" />
                  <div className="h-3 w-[5%] bg-lp-muted" />
                </div>
                <div className="flex items-center justify-between font-body text-xs">
                  <span className="text-lp-text">95% to lenders</span>
                  <span className="text-lp-muted">5% fee</span>
                </div>
              </div>
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            index={2}
            title="Claim excess"
            body="Post more than the tier minimum? Withdraw the surplus any time mid-loan, no repayment first."
            visual={
              <Chip
                icon={<FiArrowUpRight size={14} className="text-lp-accent" />}
                label="Withdraw surplus"
              />
            }
          />
          <Card
            index={3}
            title="Repay & rank up"
            body="Pay principal plus interest to get all collateral back and climb a credit tier."
            visual={
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lp-accent text-lp-accent-foreground">
                  <FiRefreshCw size={18} />
                </span>
                <Chip icon={null} label="Bronze -> Silver" />
              </div>
            }
          />
          <Card
            index={4}
            title="Health floor 1.1"
            body="The threshold sits below the lowest tier multiplier, so every tier is safe at its minimum."
            visual={
              <div className="w-full max-w-[200px] space-y-2">
                <div className="relative h-2 rounded-full bg-lp-surface">
                  <div className="h-2 w-1/4 rounded-full bg-lp-accent" />
                  <span className="absolute -top-1 left-1/4 h-4 w-0.5 -translate-x-1/2 bg-lp-text" />
                </div>
                <div className="flex items-center justify-between font-body text-[11px] text-lp-muted">
                  <span className="inline-flex items-center gap-1">
                    <FiActivity size={12} /> floor 1.1
                  </span>
                  <span>1.2x safe</span>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}
