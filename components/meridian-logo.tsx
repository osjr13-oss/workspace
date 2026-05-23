import Link from "next/link";

export function MeridianLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--text)] text-[var(--background-elevated)] shadow-[var(--shadow-tight)]">
        <span className="relative h-5 w-5 rounded-full border border-current">
          <span className="absolute left-1/2 top-[-5px] h-7 w-px -translate-x-1/2 bg-current" />
          <span className="absolute left-[-5px] top-1/2 h-px w-7 -translate-y-1/2 bg-current" />
        </span>
      </span>
      <span className="text-2xl font-extrabold tracking-[-0.035em]">Meridian</span>
    </Link>
  );
}
