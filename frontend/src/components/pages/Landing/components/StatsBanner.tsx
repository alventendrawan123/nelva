const STATS = [
  { value: "5", label: "party perspectives in the Lens" },
  { value: "4", label: "credit tiers, Bronze to Platinum" },
  { value: "1.2x", label: "min collateral once you reach Platinum" },
];

export function StatsBanner() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-16 sm:px-8">
      <div className="overflow-hidden rounded-3xl border border-lp-border bg-gradient-to-br from-lp-surface to-lp-bg">
        <div className="grid grid-cols-1 gap-px bg-lp-border md:grid-cols-4">
          <div className="bg-lp-bg p-7">
            <span className="inline-flex rounded-full bg-lp-accent px-3 py-1 font-body text-xs font-semibold text-lp-accent-foreground">
              Provably fair
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-lp-text">
              Auditor-verified matching
            </h3>
            <p className="mt-2 font-body text-sm leading-6 text-lp-muted">
              Every match is re-run on-ledger by an independent auditor - proven
              honest, not just promised.
            </p>
          </div>
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-lp-surface p-7">
              <p className="font-heading text-4xl font-bold text-lp-text">
                {stat.value}
              </p>
              <p className="mt-3 font-body text-sm leading-6 text-lp-muted">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
