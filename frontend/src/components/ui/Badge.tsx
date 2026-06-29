import type { ReactNode } from "react";

type BadgeTone = "success" | "danger" | "warning" | "accent" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  accent: "bg-accent/15 text-accent",
  neutral: "bg-surface-2 text-muted",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
