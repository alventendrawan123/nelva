"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FiCheck, FiX } from "react-icons/fi";

type FeedbackStatus = "success" | "error";

type Feedback = { id: number; status: FeedbackStatus; message: string };

type FeedbackContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);
const AUTO_DISMISS_MS = 2200;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const showSuccess = useCallback((message: string) => {
    setFeedback({ id: Date.now(), status: "success", message });
  }, []);
  const showError = useCallback((message: string) => {
    setFeedback({ id: Date.now(), status: "error", message });
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = setTimeout(() => setFeedback(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const value = useMemo<FeedbackContextValue>(
    () => ({ showSuccess, showError }),
    [showSuccess, showError],
  );

  const isSuccess = feedback?.status === "success";

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {feedback ? (
          <motion.div
            key={feedback.id}
            className="pointer-events-none fixed inset-0 z-[120] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.button
              type="button"
              onClick={() => setFeedback(null)}
              aria-live="polite"
              className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-8 py-7 text-center shadow-card"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: 8 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.9, y: 8 }
              }
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  isSuccess
                    ? "bg-success/15 text-success"
                    : "bg-danger/15 text-danger"
                }`}
              >
                {isSuccess ? (
                  <FiCheck className="h-7 w-7" />
                ) : (
                  <FiX className="h-7 w-7" />
                )}
              </span>
              <p className="text-base font-semibold text-foreground">
                {isSuccess ? "Success" : "Failed"}
              </p>
              <p className="text-sm leading-6 text-muted">{feedback.message}</p>
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
}
