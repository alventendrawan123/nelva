import type { ReactNode } from "react";
import { FiExternalLink } from "react-icons/fi";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";

type BadgeTone = "success" | "danger" | "warning" | "accent" | "neutral";

type TxRowProps = {
  symbol: string;
  title: string;
  subtitle: string;
  idLabel?: string;
  status: string;
  statusTone?: BadgeTone;
  trailing?: ReactNode;
};

export function TxRow({
  symbol,
  title,
  subtitle,
  idLabel,
  status,
  statusTone = "accent",
  trailing,
}: TxRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors duration-200 hover:border-border-strong">
      <TokenIcon symbol={symbol} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{subtitle}</span>
          {idLabel ? (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {idLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <Badge tone={statusTone}>{status}</Badge>
        <FiExternalLink className="h-4 w-4 text-muted" aria-hidden />
      </div>
    </div>
  );
}
