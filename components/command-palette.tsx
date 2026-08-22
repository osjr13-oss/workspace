"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Command,
  Files,
  FolderOpen,
  Home,
  LifeBuoy,
  MessageSquare,
  Plus,
  Search,
  Settings,
  X
} from "lucide-react";

type PaletteItem = {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "Recent";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  action?: () => void;
  shortcut?: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const items: PaletteItem[] = [
    {
      id: "new-thought",
      title: "New thought session",
      category: "Actions",
      icon: Plus,
      action: () => router.push("/chats"),
      shortcut: "N"
    },
    {
      id: "nav-workspace",
      title: "Workspace Overview",
      category: "Navigation",
      icon: Home,
      href: "/dashboard"
    },
    {
      id: "nav-think",
      title: "Think & Conversations",
      category: "Navigation",
      icon: MessageSquare,
      href: "/chats"
    },
    {
      id: "nav-notes",
      title: "Knowledge & Notes",
      category: "Navigation",
      icon: BookOpen,
      href: "/notes"
    },
    {
      id: "nav-projects",
      title: "Projects",
      category: "Navigation",
      icon: FolderOpen,
      href: "/projects"
    },
    {
      id: "nav-files",
      title: "Files & Documents",
      category: "Navigation",
      icon: Files,
      href: "/files"
    },
    {
      id: "nav-settings",
      title: "Settings & Memory",
      category: "Navigation",
      icon: Settings,
      href: "/settings"
    },
    {
      id: "nav-help",
      title: "Help & Support",
      category: "Navigation",
      icon: LifeBuoy,
      href: "/help"
    }
  ];

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      setQuery("");
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [router]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-[15vh] backdrop-blur-sm transition-all"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-[var(--border)] px-4 py-3">
          <Search size={18} className="text-[var(--muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, navigate, or start thinking..."
            className="flex-1 bg-transparent px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
              } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
                e.preventDefault();
                handleSelect(filteredItems[selectedIndex]);
              }
            }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted)]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : "text-[var(--muted-strong)] hover:bg-slate-100 hover:text-[var(--text)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} className={isSelected ? "text-white" : "text-[var(--muted)]"} />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  {item.shortcut && (
                    <kbd className={isSelected ? "border-slate-700 bg-slate-800 text-white" : ""}>
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-slate-50 px-4 py-2.5 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span>Navigation</span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>Select</span>
            <kbd>↵</kbd>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Command size={12} />
            <span>Selrano Command</span>
          </div>
        </div>
      </div>
    </div>
  );
}
