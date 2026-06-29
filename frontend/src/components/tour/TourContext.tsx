"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParty } from "@/context/PartyContext";
import { useUI } from "@/context/UIContext";
import { TOUR_STEPS, type TourStep } from "./steps";

const STORAGE_KEY = "nelva.tour.done";

type TourContextValue = {
  isActive: boolean;
  index: number;
  total: number;
  step: TourStep | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { setPersona } = useParty();
  const { setActiveHomeTab } = useUI();
  const [isActive, setIsActive] = useState(false);
  const [index, setIndex] = useState(0);

  const start = useCallback(() => {
    setIndex(0);
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    window.localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const next = useCallback(() => {
    setIndex((current) => {
      const nextIndex = current + 1;
      if (nextIndex >= TOUR_STEPS.length) {
        setIsActive(false);
        window.localStorage.setItem(STORAGE_KEY, "1");
        return current;
      }
      return nextIndex;
    });
  }, []);

  const prev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    TOUR_STEPS[index]?.onEnter?.({ setPersona, setActiveHomeTab });
  }, [isActive, index, setPersona, setActiveHomeTab]);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      return;
    }
    const timer = setTimeout(start, 800);
    return () => clearTimeout(timer);
  }, [start]);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      index,
      total: TOUR_STEPS.length,
      step: isActive ? (TOUR_STEPS[index] ?? null) : null,
      start,
      stop,
      next,
      prev,
    }),
    [isActive, index, start, stop, next, prev],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
