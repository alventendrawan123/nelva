"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { LandingLogo } from "./LandingLogo";
import { LANDING_NAV_LINKS } from "./motion";

function CtaButtons({ fullWidth = false }: { fullWidth?: boolean }) {
  const base = fullWidth
    ? "w-full py-3.5 text-[0.95rem]"
    : "px-5 py-2.5 text-sm";
  return (
    <>
      <a
        href="/app"
        className={`rounded-full bg-lp-accent text-center font-semibold text-lp-accent-foreground transition-colors hover:bg-lp-accent-hover active:scale-95 ${base}`}
      >
        Launch app
      </a>
      <a
        href="/explore"
        className={`rounded-full border border-lp-border bg-lp-surface text-center font-semibold text-lp-text transition-colors hover:bg-lp-surface-2 active:scale-95 ${base}`}
      >
        Explore
      </a>
    </>
  );
}

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
      <LandingLogo />

      <div className="hidden items-center gap-8 md:flex">
        {LANDING_NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-lp-text transition-opacity hover:opacity-70"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <CtaButtons />
      </div>

      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="text-lp-text md:hidden"
      >
        <Menu size={24} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-lp-scrim backdrop-blur-[4px] md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "tween",
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                width: "min(88vw, 360px)",
                height: "100dvh",
                boxShadow: "-12px 0 48px rgba(25,40,55,0.18)",
              }}
              className="fixed right-0 top-0 z-50 flex flex-col bg-lp-sheet md:hidden"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <LandingLogo />
                <motion.button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-lp-border text-lp-text"
                >
                  <X size={20} />
                </motion.button>
              </div>
              <div className="mx-6 h-px bg-lp-border" />
              <div className="flex flex-1 flex-col gap-1 px-4 py-6">
                {LANDING_NAV_LINKS.map((link, index) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{
                      delay: 0.18 + index * 0.07,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="rounded-xl px-3 py-3 text-[1.1rem] font-medium text-lp-text transition-colors hover:bg-white/10"
                  >
                    {link.label}
                  </motion.a>
                ))}
              </div>
              <div className="flex flex-col gap-3 px-6 pb-8">
                <CtaButtons fullWidth />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
