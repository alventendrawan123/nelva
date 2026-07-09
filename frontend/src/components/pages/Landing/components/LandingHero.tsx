"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { FiChevronRight } from "react-icons/fi";
import { LandingNav } from "./LandingNav";
import { fadeUp } from "./motion";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_131516_eca35265-ea66-4fbd-8d52-22aae6e1a503.mp4";

export function LandingHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause the background video once the hero scrolls out of view so the browser
  // stops decoding HD frames off-screen - the main source of scroll lag.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="relative flex min-h-screen flex-col overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={VIDEO_SRC}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-lp-bg via-lp-bg/40 to-lp-bg" />

      <div className="relative z-10 flex flex-1 flex-col">
        <LandingNav />

        <div className="mx-auto flex w-full max-w-[1280px] flex-1 items-center px-5 pb-16 sm:px-8">
          <div className="mx-auto flex max-w-[660px] flex-col items-center text-center">
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="font-heading text-lp-text"
              style={{
                fontSize: "clamp(1.65rem, 5vw, 3rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              <span className="whitespace-nowrap">
                Borrow &amp; lend privately
              </span>
              <br />
              with a match you can prove
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="mt-6 max-w-[560px] font-body text-lp-text/80"
              style={{
                fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)",
                lineHeight: 1.65,
              }}
            >
              Nelva is a sealed-bid P2P lending market on Canton. Your interest
              rate is never exposed to rivals, and an independent auditor can
              re-run the match on-ledger to prove it was fair.
            </motion.p>

            <motion.a
              href="/app"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-lp-accent px-6 py-3 font-body text-sm font-semibold text-lp-accent-foreground"
            >
              Launch app
              <FiChevronRight size={16} />
            </motion.a>
          </div>
        </div>
      </div>
    </header>
  );
}
