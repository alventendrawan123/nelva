"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect } from "react";
import { TabSwitcher } from "@/components/ui/TabSwitcher";
import { type HomeTab, PERSONA_TABS } from "@/config/nav";
import { useParty } from "@/context/PartyContext";
import { useUI } from "@/context/UIContext";

type HomeTabsProps = {
  panels: Record<HomeTab, ReactNode>;
};

export function HomeTabs({ panels }: HomeTabsProps) {
  const { persona } = useParty();
  const { activeHomeTab: active, setActiveHomeTab: setActive } = useUI();
  const prefersReducedMotion = useReducedMotion();
  const allowedTabs = PERSONA_TABS[persona];

  useEffect(() => {
    if (!allowedTabs.includes(active)) {
      setActive(allowedTabs[0]);
    }
  }, [allowedTabs, active, setActive]);

  return (
    <div>
      <div className="mx-auto max-w-2xl" data-tour="home-tabs">
        <TabSwitcher
          options={allowedTabs}
          active={active}
          onChange={setActive}
          ariaLabel="Home actions"
        />
      </div>
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {panels[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
