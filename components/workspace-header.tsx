export function WorkspaceHeader({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{eyebrow}</p> : null}
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
