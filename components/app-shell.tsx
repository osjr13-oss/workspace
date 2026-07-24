"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Brain,
  Files,
  FolderOpen,
  Home,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Sparkles
} from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const nav = [
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/dashboard", label: "Workspace", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/files", label: "Files", icon: Files },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/flashcards", label: "Flashcards", icon: Brain },
  { href: "/study", label: "Study", icon: Sparkles }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSignOutError(error.message || "Could not sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    // Hard navigation on purpose: a soft router.replace/refresh can serve a
    // stale prefetched RSC payload for the next page (still reflecting the
    // signed-in state) instead of re-running middleware against the
    // now-cleared session cookie, which is what left users stuck on
    // "Signing out…" with no redirect.
    window.location.assign("/signin");
  }

  return (
    <div className="layout-grid">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-[var(--border)] bg-[rgba(255,255,255,0.42)] px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <SelranoLogo href="/chats" />
        <Link href="/chats" className="btn-secondary mt-8 justify-start px-4">
          <Plus size={18} />
          New chat
        </Link>
        <nav className="mt-7 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition ${
                  active
                    ? "border border-[var(--border-strong)] bg-[var(--surface-strong)] text-[var(--text)] shadow-[var(--shadow-tight)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                }`}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-[var(--border)] pt-5">
          <Link
            href="/help"
            className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 text-sm font-bold ${
              pathname.startsWith("/help") ? "bg-[var(--surface-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
            }`}
          >
            <LifeBuoy size={18} />
            Help
          </Link>
          <Link
            href="/settings"
            className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 text-sm font-bold ${
              pathname.startsWith("/settings") ? "bg-[var(--surface-strong)]" : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
            }`}
          >
            <Settings size={18} />
            Settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <LogOut size={18} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
          {signOutError ? <p className="mt-2 text-xs font-bold text-[var(--critical)]">{signOutError}</p> : null}
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.84)] backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <SelranoLogo href="/chats" />
            <div className="flex items-center gap-2">
              <Link href="/chats" className="btn-primary min-h-10 px-4 text-sm">
                <Plus size={17} />
                Chat
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                aria-label={signingOut ? "Signing out" : "Sign out"}
                title={signingOut ? "Signing out" : "Sign out"}
                className="btn-secondary min-h-10 px-3"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
          {signOutError ? <p className="px-5 pb-3 text-xs font-bold text-[var(--critical)]">{signOutError}</p> : null}
          <nav className="flex gap-2 overflow-x-auto px-5 pb-4">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="status-pill shrink-0">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </main>
    </div>
  );
}
