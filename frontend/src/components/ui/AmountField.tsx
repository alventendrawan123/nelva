import type { InputHTMLAttributes, ReactNode } from "react";

type AmountFieldSize = "lg" | "md";

type AmountFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  suffix?: ReactNode;
  fieldSize?: AmountFieldSize;
};

const SIZE_CLASSES: Record<AmountFieldSize, string> = {
  lg: "text-3xl",
  md: "text-xl",
};

export function AmountField({
  id,
  label,
  suffix,
  fieldSize = "lg",
  className = "",
  ...props
}: AmountFieldProps) {
  return (
    <div className="rounded-2xl bg-surface-2 px-5 py-4 ring-1 ring-inset ring-border transition-colors duration-200 focus-within:ring-border-strong">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <input
          id={id}
          className={`w-full bg-transparent font-semibold text-foreground outline-none placeholder:text-muted ${SIZE_CLASSES[fieldSize]} ${className}`}
          {...props}
        />
        {suffix ? (
          <span className="shrink-0 text-lg font-medium text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
