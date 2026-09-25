import Link from "next/link";

export function AuthFrame({
  title,
  copy,
  children
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-7">
        <Link href="/" className="font-serif text-lg">
          Selrano
        </Link>
        <h1 className="mt-8 font-serif text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
