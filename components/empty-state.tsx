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
    <div className="panel grid min-h-48 place-items-center p-7 text-center">
      <div>
        <h3 className="text-base font-extrabold tracking-[-0.01em]">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
