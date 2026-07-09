"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useCreditScore, useProfile } from "@/lib/api/hooks";
import { shortParty } from "@/lib/format";

export function ProfileHeader() {
  const profile = useProfile();
  const credit = useCreditScore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profile.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const tier = credit.data?.tier ?? profile.tier;
  const repScore = credit.data?.loansRepaid ?? profile.repScore;
  const collateralMultiplier = credit.data
    ? `${credit.data.collateralMultiplier}x`
    : profile.collateralMultiplier;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-primary-foreground">
          {tier.charAt(0)}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-2xl font-bold text-foreground"
              title={profile.address}
            >
              {shortParty(profile.address)}
            </h1>
            <Badge tone="neutral">Canton</Badge>
            <Badge tone="warning">{tier}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/address?party=${encodeURIComponent(profile.address)}`,
                  "_blank",
                  "noopener",
                )
              }
              title="View this address's on-ledger transactions"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              Explorer
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted">
            Rep Score
          </p>
          <p className="text-3xl font-bold text-foreground">{repScore}</p>
        </div>
        <div className="w-40">
          <p className="text-sm font-semibold text-warning">
            {collateralMultiplier} Collateral
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-0 rounded-full bg-accent" />
          </div>
          <p className="mt-1 text-xs text-muted">Repay loans to level up</p>
        </div>
      </div>
    </div>
  );
}
