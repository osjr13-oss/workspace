import Link from "next/link";
import Image from "next/image";

const SIZES = {
  sm: { mark: 24, text: "text-[17px]" },
  md: { mark: 28, text: "text-[19px]" },
  lg: { mark: 34, text: "text-[23px]" }
} as const;

export function SelranoLogo({ href = "/", size = "md" }: { href?: string; size?: keyof typeof SIZES }) {
  const { mark, text } = SIZES[size];
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg focus-ring" aria-label="Selrano home">
      <Image src="/logo.svg" alt="" width={mark} height={Math.round(mark * 0.91)} priority />
      <span className={`${text} font-semibold tracking-[-0.025em] text-[var(--text)]`}>Selrano</span>
    </Link>
  );
}
