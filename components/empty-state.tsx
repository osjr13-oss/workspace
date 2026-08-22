export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex min-h-[180px] flex-col items-center justify-center p-8 text-center bg-white shadow-xs">
      <div className="max-w-md space-y-2">
        <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
        <p className="text-xs leading-relaxed text-[var(--muted-strong)]">{description}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
