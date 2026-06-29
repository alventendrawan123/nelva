"use client";

import { motion, useReducedMotion } from "framer-motion";

type TabSwitcherProps<T extends string> = {
  options: readonly T[];
  active: T;
  onChange: (option: T) => void;
  ariaLabel: string;
};

export function TabSwitcher<T extends string>({
  options,
  active,
  onChange,
  ariaLabel,
}: TabSwitcherProps<T>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex w-full items-center gap-1 rounded-full border border-border bg-surface p-1.5"
    >
      {options.map((option) => {
        const isActive = option === active;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option)}
            className={`relative flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              isActive ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId={`tab-indicator-${ariaLabel}`}
                className="pointer-events-none absolute inset-0 rounded-full bg-surface-3 shadow-card"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{option}</span>
          </button>
        );
      })}
    </div>
  );
}
