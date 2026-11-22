"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Globe2,
  ListChecks,
  Mail,
  MessageSquare,
  NotebookPen,
  Wallet
} from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { useChatThreads } from "@/components/chat-threads";
import { QuickActions } from "@/components/quick-actions";
import { STARTERS, setPendingMessage } from "@/lib/chat-handoff";
import { money } from "@/lib/finance";
import { formatRelative } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";
import { OWNER_TIME_ZONE, ownerToday } from "@/lib/time";
import type { Note, Project } from "@/lib/types";

type Section<T> = { status: "ready"; data: T } | { status: "not_connected" } | { status: "unavailable" } | { status: "error" };
type CalendarEvent = { id: string; title: string; start: string; end: string | null; allDay: boolean; location: string | null; link: string | null };
type TodayData = {
  calendar: Section<{ events: CalendarEvent[] }>;
  money: Section<{ thisMonth: number; lastMonthSameDay: number; categories: { label: string; total: number }[]; hasTransactions: boolean }>;
  memories: Section<{ memories: { id: string; content: string }[] }>;
};

const STARTER_ICONS = { notes: NotebookPen, week: ListChecks, reply: Mail, news: Globe2 } as const;
const EASE = [0.2, 0.7, 0.2, 1] as const;

export default function TodayPage() {
  const router = useRouter();
  const { threads, loaded: threadsLoaded } = useChatThreads();
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const full = String(profile?.full_name || user.user_metadata?.full_name || "").trim();
      setName(full.split(/\s+/)[0] || "");
    });
    void Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }).limit(3)
    ]).then(([projectRows, noteRows]) => {
      setProjects((projectRows.data as Project[]) || []);
      setNotes((noteRows.data as Note[]) || []);
    });
    void fetch("/api/today")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload: TodayData) => setToday(payload))
      .catch(() => setToday({ calendar: { status: "error" }, money: { status: "error" }, memories: { status: "error" } }));
  }, []);

  function startChat(message: string) {
    const prompt = removeEmDashes(message).trim();
    if (!prompt) return;
    setPendingMessage({ text: prompt, projectId: projectId || null });
    router.push("/chats");
  }

  const dateLine = new Date().toLocaleDateString("en-US", { timeZone: OWNER_TIME_ZONE, weekday: "long", month: "long", day: "numeric" });
  const showCalendar = today?.calendar.status !== "unavailable";
  const showMoney = today?.money.status !== "unavailable";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <p className="eyebrow">{dateLine}</p>
        <h1 className="title-display mt-2 text-[36px] leading-[1.05] sm:text-[46px]">{greeting(name)}</h1>
      </motion.header>

      <motion.div
        className="mt-6 max-w-[46rem]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            startChat(text);
          }}
        >
          <ChatComposer
            value={text}
            busy={false}
            onChange={setText}
            onStop={() => undefined}
            attachments={[]}
            onAttach={() => undefined}
            onRemoveAttachment={() => undefined}
            projects={projects}
            projectId={projectId}
            onProjectChange={setProjectId}
            projectLocked={false}
            maxAttachments={0}
            allowAttachments={false}
          />
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STARTERS.map((starter, index) => {
            const Icon = STARTER_ICONS[starter.id];
            return (
              <motion.button
                key={starter.id}
                type="button"
                className="starter-card w-auto"
                title={starter.prompt}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + index * 0.04 }}
                onClick={() => startChat(starter.prompt)}
              >
                <Icon size={15} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                {starter.title}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-1 gap-5">
          {showCalendar ? (
            <HomeCard index={0} title="Coming up" icon={<CalendarDays size={16} />} link={{ label: "Open calendar", href: "https://calendar.google.com/", external: true }} hideLink={today?.calendar.status !== "ready"}>
              <CalendarBody section={today?.calendar} />
            </HomeCard>
          ) : null}

          <HomeCard index={1} title="Pick up where you left off" icon={<MessageSquare size={16} />} link={{ label: "New chat", href: "/chats" }}>
            {!threadsLoaded ? (
              <SkeletonRows rows={3} />
            ) : threads.length ? (
              <div className="-mx-1 space-y-0.5">
                {threads.slice(0, 4).map((thread) => (
                  <Link key={thread.id} href={`/chats?thread=${thread.id}`} className="home-row">
                    <MessageSquare size={15} className="shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{removeEmDashes(thread.title) || "Untitled chat"}</span>
                    <span className="shrink-0 text-[13px] text-[var(--muted)]">{formatRelative(thread.updated_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyLine text="Your conversations will show up here. Ask anything above to start one." />
            )}
          </HomeCard>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5">
          {showMoney ? (
            <HomeCard index={3} title="This month" icon={<Wallet size={16} />} link={{ label: "Money", href: "/money" }} hideLink={today?.money.status !== "ready"}>
              <MoneyBody section={today?.money} />
            </HomeCard>
          ) : null}

          <HomeCard index={4} title="Notes" icon={<BookOpen size={16} />} link={{ label: "All notes", href: "/notes" }}>
            {notes === null ? (
              <SkeletonRows rows={2} />
            ) : notes.length ? (
              <div className="-mx-1 space-y-0.5">
                {notes.map((note) => (
                  <Link key={note.id} href="/notes" className="home-row items-start">
                    <BookOpen size={15} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{removeEmDashes(note.title) || "Untitled note"}</span>
                      <span className="block truncate text-[13px] text-[var(--muted)]">{removeEmDashes(note.content.replace(/[#*_>`-]/g, " ").trim()) || "Empty note"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyLine text="Notes you write, or ask Selrano to save, land here." action={{ label: "Write a note", href: "/notes" }} />
            )}
          </HomeCard>

          <HomeCard index={5} title="Pinned memories" icon={<Brain size={16} />} link={{ label: "Memory", href: "/memory" }}>
            <MemoryBody section={today?.memories} />
          </HomeCard>
        </div>
      </div>

      <motion.div className="mt-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3, ease: EASE }}>
        <QuickActions />
      </motion.div>
    </div>
  );
}

function greeting(name: string) {
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: OWNER_TIME_ZONE, hour: "numeric", hour12: false })) % 24;
  const part = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}

function HomeCard({
  index,
  title,
  icon,
  link,
  hideLink,
  children
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  link: { label: string; href: string; external?: boolean };
  hideLink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      aria-label={title}
      className="home-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.12 + index * 0.05, ease: EASE }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <span className="text-[var(--accent)]" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {hideLink ? null : link.external ? (
          <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--accent)]">
            {link.label} <ArrowRight size={13} />
          </a>
        ) : (
          <Link href={link.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--accent)]">
            {link.label} <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="skeleton h-4 w-4 shrink-0" />
          <span className="skeleton h-3.5 flex-1" style={{ maxWidth: `${82 - index * 14}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyLine({ text, action }: { text: string; action?: { label: string; href: string; external?: boolean } }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-[var(--background-elevated)] px-4 py-4">
      <p className="text-[14px] leading-6 text-[var(--muted-strong)]">{text}</p>
      {action ? (
        action.external ? (
          <a href={action.href} className="btn-secondary btn-sm">
            {action.label}
          </a>
        ) : (
          <Link href={action.href} className="btn-secondary btn-sm">
            {action.label}
          </Link>
        )
      ) : null}
    </div>
  );
}

function CouldNotLoad() {
  return <p className="py-1 text-[14px] text-[var(--muted)]">Could not load this right now. Try again in a moment.</p>;
}

function eventDay(start: string, allDay: boolean) {
  const day = allDay ? start.slice(0, 10) : ownerToday(new Date(start));
  const todayDate = ownerToday();
  const tomorrow = ownerToday(new Date(Date.now() + 86_400_000));
  if (day <= todayDate) return "Today";
  if (day === tomorrow) return "Tomorrow";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  const format = (value: string) => new Date(value).toLocaleTimeString("en-US", { timeZone: OWNER_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  return format(event.start);
}

function CalendarBody({ section }: { section?: TodayData["calendar"] }) {
  if (!section) return <SkeletonRows rows={3} />;
  if (section.status === "error") return <CouldNotLoad />;
  if (section.status === "not_connected") {
    return (
      <EmptyLine
        text="Connect Google to see what is coming up here, and to ask about your calendar and email in chat."
        action={{ label: "Connect Google", href: "/api/integrations/google/start", external: true }}
      />
    );
  }
  if (section.status !== "ready") return null;
  const events = section.data.events.filter((event) => ["Today", "Tomorrow"].includes(eventDay(event.start, event.allDay)));
  if (!events.length) return <p className="py-1 text-[14px] text-[var(--muted-strong)]">Nothing on your calendar today or tomorrow.</p>;

  const groups: { day: string; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const day = eventDay(event.start, event.allDay);
    const group = groups.find((item) => item.day === day);
    if (group) group.events.push(event);
    else groups.push({ day, events: [event] });
  }
  const now = Date.now();
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.day}>
          <p className="px-1 pb-1 text-[13px] font-medium text-[var(--muted)]">{group.day}</p>
          <ul className="-mx-1 space-y-0.5">
            {group.events.map((event) => {
              const happening = !event.allDay && new Date(event.start).getTime() <= now && (!event.end || new Date(event.end).getTime() > now);
              const row = (
                <>
                  <span className={`w-[4.75rem] shrink-0 text-[13px] tabular-nums ${happening ? "font-semibold text-[var(--accent)]" : "text-[var(--muted-strong)]"}`}>
                    {happening ? "Now" : eventTime(event)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{event.title}</span>
                    {event.location ? <span className="block truncate text-[13px] text-[var(--muted)]">{event.location}</span> : null}
                  </span>
                </>
              );
              return (
                <li key={event.id}>
                  {event.link ? (
                    <a href={event.link} target="_blank" rel="noreferrer" className="home-row">
                      {row}
                    </a>
                  ) : (
                    <div className="home-row">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MoneyBody({ section }: { section?: TodayData["money"] }) {
  if (!section) {
    return (
      <div className="space-y-3 py-1" aria-hidden="true">
        <span className="skeleton block h-8 w-32" />
        <span className="skeleton block h-3.5 w-48" />
        <SkeletonRows rows={2} />
      </div>
    );
  }
  if (section.status === "error") return <CouldNotLoad />;
  if (section.status === "not_connected") {
    return <EmptyLine text="Connect a bank to see this month's spending here and ask about it in chat. Read only; Selrano never moves money." action={{ label: "Connect a bank", href: "/money" }} />;
  }
  if (section.status !== "ready") return null;
  const { thisMonth, lastMonthSameDay, categories, hasTransactions } = section.data;
  if (!hasTransactions) return <p className="py-1 text-[14px] text-[var(--muted-strong)]">No transactions synced yet. Open Money to refresh.</p>;
  const difference = thisMonth - lastMonthSameDay;
  const comparison =
    lastMonthSameDay <= 0
      ? "Spent so far this month."
      : Math.abs(difference) < 1
        ? "About the same as this point last month."
        : `${money(Math.abs(difference))} ${difference > 0 ? "more" : "less"} than this point last month.`;
  const top = categories[0]?.total || 1;
  return (
    <div>
      <p className="font-display text-[34px] font-medium leading-none tracking-[-0.02em]">{money(thisMonth)}</p>
      <p className="mt-2 text-[13px] text-[var(--muted-strong)]">{comparison}</p>
      {categories.length ? (
        <ul className="mt-4 space-y-2.5">
          {categories.map((category, index) => (
            <li key={category.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{category.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted-strong)]">{money(category.total)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, (category.total / top) * 100)}%` }}
                  transition={{ duration: 0.7, delay: 0.25 + index * 0.08, ease: EASE }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MemoryBody({ section }: { section?: TodayData["memories"] }) {
  if (!section) return <SkeletonRows rows={2} />;
  if (section.status === "error") return <CouldNotLoad />;
  if (section.status !== "ready") return null;
  if (!section.data.memories.length) {
    return <EmptyLine text={'Pin the things Selrano should always keep in mind. Or say "remember that..." in any chat.'} action={{ label: "Open Memory", href: "/memory" }} />;
  }
  return (
    <ul className="space-y-2">
      {section.data.memories.map((memory) => (
        <li key={memory.id} className="rounded-xl bg-[var(--background-elevated)] px-3.5 py-2.5 text-[14px] leading-6 text-[var(--muted-strong)]">
          {memory.content}
        </li>
      ))}
    </ul>
  );
}
