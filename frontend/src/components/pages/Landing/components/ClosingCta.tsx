import { FiChevronRight } from "react-icons/fi";

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pb-8 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-lp-border bg-gradient-to-br from-lp-surface via-lp-surface to-lp-bg p-8 sm:p-14">
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="max-w-md font-heading text-3xl font-bold leading-tight text-lp-text sm:text-4xl">
              Ready to lend and borrow privately?
            </h2>
            <p className="mt-4 max-w-md font-body text-base leading-7 text-lp-muted">
              Connect a wallet, place a sealed bid, and watch the match verify
              itself.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/app"
              className="inline-flex items-center gap-2 rounded-full bg-lp-accent px-6 py-3 font-body text-sm font-semibold text-lp-accent-foreground transition-colors hover:bg-lp-accent-hover"
            >
              Launch app
              <FiChevronRight size={16} />
            </a>
            <a
              href="/explore"
              className="rounded-full border border-lp-border bg-lp-surface px-6 py-3 font-body text-sm font-semibold text-lp-text transition-colors hover:bg-lp-surface-2"
            >
              Explore
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
