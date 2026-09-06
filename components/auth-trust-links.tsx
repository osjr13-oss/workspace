import Link from "next/link";

export function AuthTrustLinks() {
  return (
    <nav aria-label="Legal and support" className="mt-8 flex justify-center gap-5 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted-strong)]">
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/support">Support</Link>
    </nav>
  );
}
