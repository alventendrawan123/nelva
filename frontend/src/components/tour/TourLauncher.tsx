"use client";

import { HelpCircle } from "lucide-react";
import { useTour } from "./TourContext";

export function TourLauncher() {
  const { start, isActive } = useTour();

  if (isActive) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Start guided tour"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_var(--color-primary)] transition-colors duration-200 hover:bg-primary-hover"
    >
      <HelpCircle className="h-4 w-4" />
      Tour
    </button>
  );
}
