"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";

export function SiteHeader() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: onHome ? "#how" : "/#how", label: "How it works" },
    { href: onHome ? "#features" : "/#features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/guides", label: "Guides" },
    { href: "/changelog", label: "Changelog" }
  ];
  const waitlistHref = onHome ? "#waitlist" : "/signup";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-30 transition-[background,border-color,box-shadow] duration-200 ${
        scrolled || open
          ? "border-b border-[var(--border)] bg-[rgba(246,243,236,0.86)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <SelranoLogo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => {
            const active = !link.href.includes("#") && pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-[14px] font-medium transition-colors hover:text-[var(--text)] ${
                  active ? "text-[var(--text)]" : "text-[var(--muted-strong)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/signin" className="btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href={waitlistHref} className="btn-primary btn-sm">
            Join the waitlist
          </Link>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="icon-button md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open ? (
        <div ref={panelRef} id="mobile-nav" className="border-t border-[var(--border)] px-5 pb-6 pt-3 md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--border)] py-3.5 text-[17px] font-medium text-[var(--text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/signin" className="btn-secondary" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <Link href={waitlistHref} className="btn-primary" onClick={() => setOpen(false)}>
              Join the waitlist
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
