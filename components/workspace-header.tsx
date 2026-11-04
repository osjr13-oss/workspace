export function WorkspaceHeader({
  title,
  eyebrow,
  description,
  children
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="title-display mt-1.5 text-[34px] sm:text-[40px]">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-[15px] leading-6 text-[var(--muted-strong)]">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
