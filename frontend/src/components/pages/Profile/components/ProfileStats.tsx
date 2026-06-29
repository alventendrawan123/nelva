"use client";

import { StatTile } from "@/components/ui/StatTile";
import { useProfile } from "@/lib/api/hooks";

export function ProfileStats() {
  const { stats } = useProfile();
  const tiles = [
    { label: "Loans Repaid", value: stats.loansRepaid },
    { label: "Defaulted", value: stats.defaulted },
    { label: "Active Borrows", value: stats.activeBorrows },
    { label: "Active Lends", value: stats.activeLends },
    { label: "Pending Intents", value: stats.pendingIntents },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value} />
      ))}
    </div>
  );
}
