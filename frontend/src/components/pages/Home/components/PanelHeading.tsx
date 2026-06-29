type PanelHeadingProps = {
  title: string;
  description: string;
};

export function PanelHeading({ title, description }: PanelHeadingProps) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        {description}
      </p>
    </header>
  );
}
