import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Reading layout for Terms, Privacy, and Security. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[44rem] px-5 pb-24 pt-14 sm:px-8 sm:pt-20">{children}</main>
      <SiteFooter />
    </>
  );
}
