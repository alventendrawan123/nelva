"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// A gentle, both-directions reveal: sections fade + drift into place when they
// enter the viewport, whether you scroll down or back up. Kept subtle (small
// offset, soft ease) so repeated passes never feel busy.
export function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
