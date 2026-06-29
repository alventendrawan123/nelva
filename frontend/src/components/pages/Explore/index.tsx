import { Card } from "@/components/ui/Card";
import { ExploreHero } from "./components/ExploreHero";

const STEPS = [
  {
    title: "1 · Sealed bids",
    body: "Lenders post rate bids that stay private on Canton. No competitor — and not even the operator — can read another lender's rate.",
  },
  {
    title: "2 · Deterministic match",
    body: "The operator runs one deterministic matching round. Cheapest capital fills each borrow; the borrower pays a single blended rate.",
  },
  {
    title: "3 · Auditable proof",
    body: "An auditor re-runs the match over every sealed bid and stamps a GREEN or RED badge — honesty is provable on-ledger, not just promised.",
  },
];

export function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <ExploreHero />
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          How Nelva matches
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.title} className="p-6">
              <h3 className="text-base font-bold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
