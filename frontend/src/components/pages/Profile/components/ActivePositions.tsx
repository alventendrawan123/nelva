"use client";

import { Card } from "@/components/ui/Card";
import { useProfile } from "@/lib/api/hooks";

const AXIS_TICKS = [4, 3, 2, 1, 0] as const;
const CHART_MAX = 4;

export function ActivePositions() {
  const { stats } = useProfile();
  const chart = [
    { label: "Lending", value: stats.activeLends },
    { label: "Borrowing", value: stats.activeBorrows },
    { label: "Intents", value: stats.pendingIntents },
  ];

  return (
    <Card className="p-6">
      <h2 className="mb-6 text-lg font-bold text-foreground">
        Active Positions
      </h2>
      <div className="flex gap-4">
        <div className="flex flex-col justify-between text-xs text-muted">
          {AXIS_TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="flex flex-1 items-end justify-around gap-4 border-b border-l border-border pb-2 pl-4">
          {chart.map((entry) => {
            const heightPercent = Math.min(
              (entry.value / CHART_MAX) * 100,
              100,
            );
            return (
              <div
                key={entry.label}
                className="flex w-full flex-col items-center gap-2"
              >
                <div
                  className="w-8 rounded-t bg-accent"
                  style={{ height: `${heightPercent}%`, minHeight: "2px" }}
                />
                <span className="text-xs text-muted">{entry.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
