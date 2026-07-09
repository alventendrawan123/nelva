export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lp-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 font-heading text-3xl font-bold text-lp-text sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 font-body text-base leading-7 text-lp-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
