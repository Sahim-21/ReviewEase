type StepHeaderProps = {
  title: string;
  subtitle?: string;
};

export function StepHeader({ title, subtitle }: StepHeaderProps) {
  return (
    <header className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
    </header>
  );
}
