"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Brain,
  Command,
  Files,
  FolderOpen,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  X
} from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { CommandPalette } from "@/components/command-palette";
import { MemoryInspectorModal } from "@/components/memory-inspector-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/chats", label: "Think", icon: MessageSquare },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/files", label: "Files", icon: Files }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    window.location.assign("/signin");
  }

  return (
    <div className="layout-grid min-h-screen bg-[var(--background)]">
      <CommandPalette />
      <MemoryInspectorModal
        open={memoryModalOpen}
        onClose={() => setMemoryModalOpen(false)}
      />

      {/* Desktop Enterprise Sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--border)] bg-white px-4 py-5 lg:flex">
        <div className="flex items-center px-2">
          <SelranoLogo href="/dashboard" />
        </div>

        {/* Quick Actions & Command Palette Trigger */}
        <div className="mt-5 space-y-2">
          <Link
            href="/chats"
            className="btn-primary w-full justify-between px-3 text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span>New Thought</span>
            </div>
            <kbd className="border-slate-700 bg-slate-800 text-slate-300 text-[10px]">N</kbd>
          </Link>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true })
              );
            }}
            className="flex min-h-[36px] w-full items-center justify-between rounded-lg border border-[var(--border)] bg-slate-50/80 px-3 text-xs text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:bg-white hover:text-[var(--text)]"
          >
            <div className="flex items-center gap-2">
              <Search size={14} />
              <span>Quick Search</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <Command size={10} />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="mt-6 flex-1 space-y-1">
          <p className="px-2 pb-2 text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase">
            Workspace
          </p>
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[38px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-[var(--muted-strong)] hover:bg-slate-100 hover:text-[var(--text)]"
                }`}
              >
                <Icon
                  size={17}
                  className={active ? "text-white" : "text-[var(--muted)]"}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="px-2 pb-2 text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase">
              Intelligence
            </p>
            <button
              type="button"
              onClick={() => setMemoryModalOpen(true)}
              className="flex min-h-[38px] w-full items-center justify-between rounded-lg px-3 text-sm font-semibold text-[var(--muted-strong)] transition hover:bg-slate-100 hover:text-[var(--text)]"
            >
              <div className="flex items-center gap-3">
                <Brain size={17} className="text-[var(--muted)]" />
                <span>Memory Bank</span>
              </div>
              <span className="badge badge-success text-[10px]">Active</span>
            </button>
          </div>
        </nav>

        {/* Footer & User Actions */}
        <div className="border-t border-[var(--border)] pt-4 space-y-1">
          <Link
            href="/help"
            className={`flex min-h-[36px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
              pathname.startsWith("/help")
                ? "bg-slate-100 font-semibold text-[var(--text)]"
                : "text-[var(--muted-strong)] hover:bg-slate-100 hover:text-[var(--text)]"
            }`}
          >
            <LifeBuoy size={16} className="text-[var(--muted)]" />
            <span>Help & Support</span>
          </Link>
          <Link
            href="/settings"
            className={`flex min-h-[36px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
              pathname.startsWith("/settings")
                ? "bg-slate-100 font-semibold text-[var(--text)]"
                : "text-[var(--muted-strong)] hover:bg-slate-100 hover:text-[var(--text)]"
            }`}
          >
            <Settings size={16} className="text-[var(--muted)]" />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex min-h-[36px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={16} />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
          {signOutError && (
            <p className="mt-1 px-2 text-xs font-semibold text-[var(--critical)]">{signOutError}</p>
          )}
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <SelranoLogo href="/dashboard" />
          <div className="flex items-center gap-2">
            <Link href="/chats" className="btn-primary min-h-[34px] px-3 text-xs">
              <Plus size={14} />
              Thought
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-slate-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="border-b border-[var(--border)] bg-white px-4 py-4 space-y-1 lg:hidden">
            {navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                    active ? "bg-slate-900 text-white" : "text-[var(--muted-strong)] hover:bg-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="border-t border-[var(--border)] pt-2 mt-2">
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted-strong)]"
              >
                <Settings size={16} />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-600"
              >
                <LogOut size={16} />
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>
          </div>
        )}

        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
