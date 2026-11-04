export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--background-elevated)] p-8 text-center">
      <div className="flex flex-col items-center">
        {icon ? (
          <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</span>
        ) : null}
        <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--muted-strong)]">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
