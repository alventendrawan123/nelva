"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { SectionTitle } from "./SectionTitle";

const FAQS = [
  {
    q: "What is Nelva?",
    a: "A sealed-bid P2P lending market on Canton where rates stay private and the match is independently verifiable.",
  },
  {
    q: "How are lending rates discovered?",
    a: "Lenders submit sealed bids; a deterministic engine matches the cheapest first and publishes a blended rate - honest bidding is always optimal.",
  },
  {
    q: "Can the operator see my bid?",
    a: "The matching engine sees your rate to compute the match, but rival lenders and borrowers never do, and the operator can't fabricate the result: the auditor re-runs it and Accept re-validates it on-ledger.",
  },
  {
    q: "What is auditable matching?",
    a: "An independent auditor re-executes the same deterministic match on-ledger and flips a GREEN or RED badge - proving the published match wasn't rigged.",
  },
  {
    q: "How do credit tiers and collateral work?",
    a: "Every repaid loan ranks you up (Bronze to Platinum), and higher tiers require less collateral (2.0x down to 1.2x).",
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24"
    >
      <SectionTitle eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 divide-y divide-lp-border border-t border-lp-border">
        {FAQS.map((item, index) => {
          const isOpen = index === openIndex;
          return (
            <div key={item.q}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-heading text-base font-bold text-lp-text">
                  {item.q}
                </span>
                {isOpen ? (
                  <Minus size={18} className="shrink-0 text-lp-accent" />
                ) : (
                  <Plus size={18} className="shrink-0 text-lp-accent" />
                )}
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 font-body text-sm leading-7 text-lp-muted">
                      {item.a}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
