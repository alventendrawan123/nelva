"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { HomeTab } from "@/config/nav";

type UIContextValue = {
  activeHomeTab: HomeTab;
  setActiveHomeTab: (tab: HomeTab) => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>("Borrow");

  const value = useMemo<UIContextValue>(
    () => ({ activeHomeTab, setActiveHomeTab }),
    [activeHomeTab],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
