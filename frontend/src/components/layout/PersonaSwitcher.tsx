"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PERSONAS } from "@/config/nav";
import { useParty } from "@/context/PartyContext";
import { useWallet } from "@/context/WalletContext";

export function PersonaSwitcher() {
  const { persona: active, setPersona: setActive } = useParty();
  const { partyId } = useWallet();
  const prefersReducedMotion = useReducedMotion();

  // a connected wallet is the single identity — the demo persona switcher hides
  if (partyId) return null;

  return (
    <fieldset
      aria-label="Persona perspective"
      data-tour="persona"
      className="hidden items-center gap-1 rounded-full border border-border bg-surface p-1 lg:flex"
    >
      {PERSONAS.map((persona) => {
        const isActive = persona === active;
        return (
          <button
            key={persona}
            type="button"
            aria-pressed={isActive}
            onClick={() => setActive(persona)}
            className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              isActive
                ? "text-primary-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId="persona-indicator"
                className="pointer-events-none absolute inset-0 rounded-full bg-accent"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{persona}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
