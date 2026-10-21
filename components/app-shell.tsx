"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  SquarePen,
  Trash2,
  X
} from "lucide-react";
import { ChatThreadsProvider, groupThreads, useChatThreads } from "@/components/chat-threads";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";

const nav: Array<{ href: string; label: string; icon: typeof Settings }> = [];

const COLLAPSED_KEY = "selrano.sidebar.collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatThreadsProvider>
      <Shell>{children}</Shell>
    </ChatThreadsProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage can be unavailable (private windows); the sidebar just starts open.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Not remembered, which is fine.
      }
      return next;
    });
  }

  // The drawer closes whenever the page changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="app-frame">
      <aside
        className={`sidebar hidden lg:flex ${collapsed ? "sidebar-collapsed" : ""}`}
        aria-label="Navigation"
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="drawer-scrim absolute inset-0"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="sidebar drawer-panel relative flex h-full"
            aria-label="Navigation"
            // Any link closes the drawer, including chats that only change ?thread=.
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
            }}
          >
            <SidebarContent collapsed={false} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="topbar lg:hidden">
          <button type="button" className="icon-button" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
            <Menu size={20} />
          </button>
          <Link href="/chats" className="text-[17px] font-extrabold tracking-[-0.02em]">
            Selrano
          </Link>
          <Link href="/chats" className="icon-button" aria-label="New chat" title="New chat">
            <SquarePen size={19} />
          </Link>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onClose
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onClose?: () => void;
}) {
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
    <div className="flex min-h-0 w-full flex-col">
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-3 pt-4`}>
        {collapsed ? null : (
          <Link href="/chats" className="flex items-center gap-2.5 px-2">
            <Image src="/logo.svg" alt="" width={28} height={28} priority />
            <span className="text-lg font-extrabold tracking-[-0.03em]">Selrano</span>
          </Link>
        )}
        {onToggleCollapsed ? (
          <button
            type="button"
            className="icon-button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="px-3 pt-4">
        <Link href="/chats" className={`side-item side-item-strong ${collapsed ? "mx-auto w-10 justify-center px-0" : ""}`} title="New chat">
          <SquarePen size={17} />
          {collapsed ? <span className="sr-only">New chat</span> : "New chat"}
        </Link>
      </div>

      <nav className="space-y-0.5 px-3 pt-3" aria-label="Sections">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`side-item ${active ? "side-item-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Icon size={17} />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>

      {collapsed ? <div className="flex-1" /> : (
        <Suspense fallback={<div className="flex-1" />}>
          <RecentChats />
        </Suspense>
      )}

      <div className="space-y-0.5 border-t border-[var(--border)] px-3 py-3">
        <Link
          href="/settings"
          title="Settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`side-item ${pathname.startsWith("/settings") ? "side-item-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Settings size={17} />
          {collapsed ? <span className="sr-only">Settings</span> : "Settings"}
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          title="Sign out"
          className={`side-item w-full ${collapsed ? "justify-center px-0" : ""}`}
        >
          <LogOut size={17} />
          {collapsed ? <span className="sr-only">Sign out</span> : signingOut ? "Signing out..." : "Sign out"}
        </button>
        {signOutError ? <p className="px-3 pt-1 text-xs font-bold text-[var(--critical)]">{signOutError}</p> : null}
      </div>
    </div>
  );
}

function RecentChats() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { threads, loaded, remove } = useChatThreads();
  const [query, setQuery] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activeId = pathname === "/chats" ? searchParams.get("thread") : null;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle ? threads.filter((thread) => thread.title.toLowerCase().includes(needle)) : threads;
    return groupThreads(matching);
  }, [threads, query]);

  async function confirmDelete(id: string) {
    setError("");
    const failure = await remove(id);
    setConfirmingId(null);
    if (failure) {
      setError(failure);
      return;
    }
    if (activeId === id) router.push("/chats");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-5">
      <div className="flex items-center justify-between px-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Chats</p>
      </div>
      {threads.length > 6 ? (
        <label className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] px-3 text-sm">
          <Search size={14} className="shrink-0 text-[var(--muted)]" />
          <input
            aria-label="Search chats"
            placeholder="Search chats"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-9 w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
      ) : null}
      {error ? <p className="px-5 pt-2 text-xs font-bold text-[var(--critical)]">{error}</p> : null}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loaded && !threads.length ? (
          <p className="px-2 py-2 text-sm text-[var(--muted)]">Your conversations will appear here.</p>
        ) : null}
        {loaded && threads.length > 0 && !groups.length ? (
          <p className="px-2 py-2 text-sm text-[var(--muted)]">No chats match.</p>
        ) : null}
        {groups.map((group) => (
          <section key={group.label} className="pt-2">
            <h2 className="px-2 pb-1 pt-2 text-[11px] font-bold text-[var(--muted)]">{group.label}</h2>
            <ul className="space-y-0.5">
              {group.threads.map((thread) => {
                const title = removeEmDashes(thread.title) || "Untitled chat";
                const active = activeId === thread.id;
                if (confirmingId === thread.id) {
                  return (
                    <li key={thread.id} className="flex items-center gap-1 rounded-xl bg-[var(--surface-subtle)] py-1 pl-3 pr-1">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">Delete this chat?</span>
                      <button type="button" className="chip-button text-[var(--critical)]" onClick={() => confirmDelete(thread.id)}>
                        Delete
                      </button>
                      <button type="button" className="chip-button" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={thread.id} className="group/thread relative">
                    <Link
                      href={`/chats?thread=${thread.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`block truncate rounded-xl py-2 pl-3 pr-9 text-sm transition ${
                        active ? "bg-[var(--surface-strong)] font-bold shadow-[var(--shadow-tight)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-subtle)]"
                      }`}
                    >
                      {title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(thread.id)}
                      className="thread-action absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--critical)]"
                      aria-label={`Delete ${title}`}
                      title="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
