"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldQuestion,
  Sliders,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  useCheatMatch,
  useLens,
  useProposals,
  useRunMatch,
  useSeed,
  useVerify,
} from "@/lib/api/hooks";
import type { LensView } from "@/lib/api/schemas";
import { formatAmount, formatRate } from "@/lib/format";
import { PanelHeading } from "./PanelHeading";

type Tone = "shared" | "only" | "hidden";
type LensCell = { label: string; tone: Tone };
type LensColumn = {
  persona: string;
  caption: string;
  icon: LucideIcon;
  cells: LensCell[];
};

const DOT_CLASSES: Record<Tone, string> = {
  shared: "bg-success",
  only: "bg-warning",
  hidden: "bg-muted",
};

const LEGEND: { label: string; tone: Tone }[] = [
  { label: "Public", tone: "shared" },
  { label: "This party only", tone: "only" },
  { label: "Hidden", tone: "hidden" },
];

function buildColumns(lens: LensView): LensColumn[] {
  const { perspectives } = lens;
  return [
    {
      persona: "Lender",
      caption: "Sees only its own bid",
      icon: User,
      cells:
        perspectives.lender.bids.length > 0
          ? perspectives.lender.bids.map((bid) => ({
              label: `${formatAmount(bid.amount)} at ${formatRate(bid.rate)}`,
              tone: "only" as const,
            }))
          : [{ label: "No own bid", tone: "hidden" as const }],
    },
    {
      persona: "Borrower",
      caption: "Sees only its own loan",
      icon: User,
      cells: perspectives.borrower.proposal
        ? [
            {
              label: `Loan ${formatAmount(perspectives.borrower.proposal.principal)}`,
              tone: "only" as const,
            },
            {
              label: `Blended ${formatRate(perspectives.borrower.proposal.blendedRate)}`,
              tone: "only" as const,
            },
          ]
        : [{ label: "No proposal", tone: "hidden" as const }],
    },
    {
      persona: "Operator",
      caption: "Sees all bids, runs the match",
      icon: Sliders,
      cells: perspectives.operator.bids.map((bid) => ({
        label: `${bid.lender}: ${formatAmount(bid.amount)} at ${formatRate(bid.rate)}`,
        tone: "only" as const,
      })),
    },
    {
      persona: "Auditor",
      caption: "Sees all bids, proves honesty",
      icon: ShieldCheck,
      cells: perspectives.auditor.bids.map((bid) => ({
        label: `${bid.lender}: ${formatAmount(bid.amount)} at ${formatRate(bid.rate)}`,
        tone: "only" as const,
      })),
    },
    {
      persona: "Outsider",
      caption: "Public summary only",
      icon: Eye,
      cells: [
        {
          label: `Active loans: ${perspectives.outsider.status.activeLoans}`,
          tone: "shared" as const,
        },
        { label: "Bids hidden", tone: "hidden" as const },
        { label: "Rates hidden", tone: "hidden" as const },
      ],
    },
  ];
}

export function LensPanel() {
  const [selected, setSelected] = useState("");
  const proposals = useProposals();
  const runMatch = useRunMatch();
  const cheatMatch = useCheatMatch();
  const seed = useSeed();
  const verify = useVerify();

  const activeId = selected || proposals.data?.[0]?.proposalId || "";
  const lens = useLens(activeId);
  const badge = lens.data?.perspectives.auditor.badge ?? null;
  const proposal = lens.data?.perspectives.operator.proposal ?? null;

  const handleRun = () =>
    runMatch.mutate(undefined, {
      onSuccess: (result) => setSelected(result.proposals[0]?.proposalId ?? ""),
    });
  const handleCheat = () =>
    cheatMatch.mutate(undefined, {
      onSuccess: (result) => setSelected(result.proposals[0]?.proposalId ?? ""),
    });

  return (
    <div>
      <PanelHeading
        title="Lens"
        description="One ledger, five perspectives. Run a match, then let the auditor prove it was honest. Cheat it and the badge turns red."
      />

      <Card
        className="mb-6 flex flex-wrap items-center gap-3 p-4"
        data-tour="lens-controls"
      >
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Demo controls
        </span>
        <Button onClick={handleRun} disabled={runMatch.isPending} data-tour="run-match">
          <Play className="h-4 w-4" />
          Run Match
        </Button>
        <Button
          variant="secondary"
          onClick={handleCheat}
          disabled={cheatMatch.isPending}
          data-tour="cheat-match"
        >
          <AlertTriangle className="h-4 w-4" />
          Cheat Match
        </Button>
        <Button
          variant="ghost"
          onClick={() => seed.mutate(undefined, { onSuccess: () => setSelected("") })}
          disabled={seed.isPending}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {proposals.data && proposals.data.length > 0 ? (
          <select
            aria-label="Select proposal"
            value={activeId}
            onChange={(event) => setSelected(event.target.value)}
            className="ml-auto rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-foreground"
          >
            {proposals.data.map((proposal) => (
              <option key={proposal.proposalId} value={proposal.proposalId}>
                {proposal.proposalId} ({proposal.status})
              </option>
            ))}
          </select>
        ) : null}
      </Card>

      <QueryState
        isLoading={lens.isLoading && Boolean(activeId)}
        isError={lens.isError}
        isEmpty={!activeId}
        errorMessage="Could not load the Lens view."
        emptyMessage="Run a match to inspect a proposal through the Lens."
      >
        {lens.data ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile label="Proposal" value={activeId || "-"} />
              <KpiTile
                label="Principal"
                value={proposal ? formatAmount(proposal.principal) : "-"}
              />
              <KpiTile
                label="Blended Rate"
                value={proposal ? formatRate(proposal.blendedRate) : "-"}
              />
              <KpiTile
                label="Audit Verdict"
                value={badge ? badge.verdict : "Pending"}
                tone={
                  badge?.verdict === "GREEN"
                    ? "success"
                    : badge?.verdict === "RED"
                      ? "danger"
                      : "muted"
                }
              />
            </div>

            <section>
              <SectionLabel>Who sees what</SectionLabel>
              <div
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
                data-tour="lens-columns"
              >
                {buildColumns(lens.data).map((column) => (
                  <PerspectiveCard key={column.persona} column={column} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {LEGEND.map((entry) => (
                  <span
                    key={entry.tone}
                    className="flex items-center gap-2 text-xs text-muted"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${DOT_CLASSES[entry.tone]}`}
                      aria-hidden
                    />
                    {entry.label}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Auditor</SectionLabel>
              <VerdictBanner
                badge={badge}
                isVerifying={verify.isPending}
                onVerify={() => verify.mutate(activeId)}
              />
            </section>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function VerdictBanner({
  badge,
  isVerifying,
  onVerify,
}: {
  badge: LensView["perspectives"]["auditor"]["badge"];
  isVerifying: boolean;
  onVerify: () => void;
}) {
  const isGreen = badge?.verdict === "GREEN";
  const isRed = badge?.verdict === "RED";

  const tone = isGreen
    ? "border-success/30 bg-success/10"
    : isRed
      ? "border-danger/30 bg-danger/10"
      : "border-border bg-surface";

  return (
    <Card
      className={`flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between ${tone}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isGreen
              ? "bg-success/15 text-success"
              : isRed
                ? "bg-danger/15 text-danger"
                : "bg-surface-2 text-muted"
          }`}
        >
          {isGreen ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isRed ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <ShieldQuestion className="h-5 w-5" />
          )}
        </span>
        <div>
          <p
            className={`text-sm font-bold ${
              isGreen
                ? "text-success"
                : isRed
                  ? "text-danger"
                  : "text-foreground"
            }`}
          >
            {isGreen
              ? "Honest match"
              : isRed
                ? "Cheat detected"
                : "Not verified yet"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {badge
              ? badge.reason
              : "Let the auditor re-run the match over every bid to prove it is honest."}
          </p>
        </div>
      </div>
      <Button
        onClick={onVerify}
        disabled={isVerifying}
        className="shrink-0"
        data-tour="verify-btn"
      >
        <ShieldCheck className="h-4 w-4" />
        {isVerifying ? "Verifying..." : "Verify"}
      </Button>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

function KpiTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "muted"
          ? "text-muted"
          : "text-foreground";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-2 truncate text-2xl font-bold ${valueClass}`}>
        {value}
      </p>
    </Card>
  );
}

function PerspectiveCard({ column }: { column: LensColumn }) {
  const Icon = column.icon;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {column.persona}
          </h3>
        </div>
      </div>
      <p className="text-xs text-muted">{column.caption}</p>
      <ul className="flex flex-1 flex-col gap-2 border-t border-border pt-3">
        {column.cells.map((cell, cellIndex) => (
          <li
            key={`${column.persona}-${cellIndex}`}
            className="flex items-start gap-2 text-xs"
          >
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[cell.tone]}`}
              aria-hidden
            />
            <span className="text-muted">{cell.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
