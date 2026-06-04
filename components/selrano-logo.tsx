import Link from "next/link";
import Image from "next/image";

export function SelranoLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Image src="/logo.svg" alt="Selrano" width={40} height={40} priority />
      <span className="text-2xl font-extrabold tracking-[-0.035em]">Selrano</span>
    </Link>
  );
}
