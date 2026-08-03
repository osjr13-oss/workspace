export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="mx-auto grid min-h-[40vh] max-w-7xl place-items-center px-5 py-8 sm:px-6 lg:py-10">
      <span className="status-pill">{label}</span>
    </div>
  );
}
