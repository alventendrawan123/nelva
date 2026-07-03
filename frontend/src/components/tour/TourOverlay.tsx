"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MousePointerClick, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TOUR_STEPS } from "./steps";
import { useTour } from "./TourContext";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const CARD_WIDTH = 340;
const CARD_EST_HEIGHT = 230;

export function TourOverlay() {
  const { isActive, step, index, total, next, prev, stop } = useTour();
  const prefersReducedMotion = useReducedMotion();
  const [rect, setRect] = useState<Rect | null>(null);

  const target = step?.target;
  const clickToAdvance = step?.clickToAdvance ?? false;

  useEffect(() => {
    if (!isActive || !target) {
      setRect(null);
      return;
    }

    let frame = 0;
    let scrolled = false;
    const start = performance.now();

    const measure = () => {
      const element = document.querySelector(`[data-tour="${target}"]`);
      if (element) {
        if (!scrolled) {
          element.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolled = true;
        }
        const box = element.getBoundingClientRect();
        setRect({
          top: box.top - PADDING,
          left: box.left - PADDING,
          width: box.width + PADDING * 2,
          height: box.height + PADDING * 2,
        });
      }
      if (performance.now() - start < 900) {
        frame = requestAnimationFrame(measure);
      }
    };

    frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isActive, target]);

  useEffect(() => {
    if (!isActive || !target || !clickToAdvance) {
      return;
    }

    let element: Element | null = null;
    const advance = () => next();
    const finder = setInterval(() => {
      const found = document.querySelector(`[data-tour="${target}"]`);
      if (found) {
        clearInterval(finder);
        element = found;
        element.addEventListener("click", advance, { once: true });
      }
    }, 80);

    return () => {
      clearInterval(finder);
      element?.removeEventListener("click", advance);
    };
  }, [isActive, target, clickToAdvance, next]);

  if (!isActive || !step) {
    return null;
  }

  const isLast = index === total - 1;

  const cardStyle: React.CSSProperties = (() => {
    if (!rect || !target) {
      return {
        left: "50%",
        top: "50%",
        width: CARD_WIDTH,
        transform: "translate(-50%, -50%)",
      };
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(
      Math.max(rect.left, 16),
      viewportWidth - CARD_WIDTH - 16,
    );
    const spaceBelow = viewportHeight - (rect.top + rect.height);
    const top =
      spaceBelow > CARD_EST_HEIGHT + 24
        ? rect.top + rect.height + 12
        : Math.max(16, rect.top - CARD_EST_HEIGHT - 12);
    return { left, top, width: CARD_WIDTH };
  })();

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {rect && target ? (
        <>
          <motion.div
            className="absolute rounded-2xl"
            initial={false}
            animate={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 300, damping: 30 }
            }
            style={{ boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.74)" }}
          />
          <motion.div
            className="absolute rounded-2xl ring-2 ring-primary"
            initial={false}
            animate={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: prefersReducedMotion
                ? "0 0 0 4px rgba(124, 92, 255, 0.35)"
                : [
                    "0 0 0 0 rgba(124, 92, 255, 0.5)",
                    "0 0 0 12px rgba(124, 92, 255, 0)",
                  ],
            }}
            transition={{
              top: { type: "spring", stiffness: 300, damping: 30 },
              left: { type: "spring", stiffness: 300, damping: 30 },
              width: { type: "spring", stiffness: 300, damping: 30 },
              height: { type: "spring", stiffness: 300, damping: 30 },
              boxShadow: {
                duration: 1.4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeOut",
              },
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/74" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="pointer-events-auto absolute rounded-2xl border border-border bg-surface p-5 shadow-card"
          style={cardStyle}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <button
            type="button"
            aria-label="Close tour"
            onClick={stop}
            className="absolute right-3 top-3 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Step {index + 1} of {total}
          </p>
          <h3 className="mt-1 text-lg font-bold text-foreground">
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((dotStep, dotIndex) => (
                <span
                  key={dotStep.id}
                  className={`h-1.5 w-1.5 rounded-full ${
                    dotIndex === index ? "bg-primary" : "bg-border-strong"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={index > 0 ? prev : stop}
                className="px-4 py-2 text-xs"
              >
                {index > 0 ? "Back" : "Skip"}
              </Button>
              {clickToAdvance ? (
                <motion.span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                  animate={
                    prefersReducedMotion ? undefined : { opacity: [1, 0.5, 1] }
                  }
                  transition={{
                    duration: 1.4,
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                >
                  <MousePointerClick className="h-4 w-4" />
                  Click the button
                </motion.span>
              ) : (
                <Button onClick={next} className="px-4 py-2 text-xs">
                  {isLast ? "Finish" : "Next"}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
