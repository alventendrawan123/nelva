import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section";
  "data-tour"?: string;
};

export function Card({ className = "", as = "div", ...props }: CardProps) {
  const Component = as;
  return (
    <Component
      className={`rounded-3xl border border-border bg-surface shadow-card ${className}`}
      {...props}
    />
  );
}
