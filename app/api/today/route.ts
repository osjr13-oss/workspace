import { NextResponse } from "next/server";
import { summarize, type TransactionRow } from "@/lib/finance";
import { getGoogleConnection, isGoogleConfigured, upcomingCalendarEvents, type UpcomingEvent } from "@/lib/google";
import { isPlaidConfigured, plaidEnvironment } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";
import { ownerMonthStart, ownerToday } from "@/lib/time";

export const runtime = "nodejs";

type Section<T> = { status: "ready"; data: T } | { status: "not_connected" } | { status: "unavailable" } | { status: "error" };

type CalendarData = { events: UpcomingEvent[] };
type MoneyData = {
  thisMonth: number;
  lastMonthSameDay: number;
  categories: { label: string; total: number }[];
  hasTransactions: boolean;
};
type MemoryData = { memories: { id: string; content: string }[] };

/**
 * What the Today page shows beyond the user's own rows: the next day and a half
 * of calendar, this month's spending (from already-synced transactions, so no
 * bank call on page load), and pinned memories. Each part fails on its own.
 */
export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const calendar = async (): Promise<Section<CalendarData>> => {
    if (!isGoogleConfigured()) return { status: "unavailable" };
    const connection = await getGoogleConnection(user.id);
    if (!connection) return { status: "not_connected" };
    const now = new Date();
    const events = await upcomingCalendarEvents(connection, now, new Date(now.getTime() + 48 * 3_600_000));
    return { status: "ready", data: { events } };
  };

  const money = async (): Promise<Section<MoneyData>> => {
    if (!isPlaidConfigured()) return { status: "unavailable" };
    const admin = createSupabaseAdminClient();
    const { count, error: itemError } = await admin
      .from("plaid_items")
      .select("item_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("environment", plaidEnvironment());
    if (itemError) throw itemError;
    if (!count) return { status: "not_connected" };

    const monthStart = ownerMonthStart();
    const lastMonthStart = ownerMonthStart(-1);
    const today = ownerToday();
    // The same point in last month, so early in the month the comparison is fair.
    const sameDayLastMonth = `${lastMonthStart.slice(0, 8)}${today.slice(8, 10)}`;
    const { data, error } = await supabase
      .from("plaid_transactions")
      .select("transaction_id, account_id, amount, date, name, merchant_name, pending, category, category_detailed")
      .eq("user_id", user.id)
      .gte("date", lastMonthStart)
      .order("date", { ascending: false })
      .limit(3000);
    if (error) throw error;
    const rows = (data || []) as TransactionRow[];
    const current = summarize(rows.filter((tx) => tx.date >= monthStart));
    const previous = summarize(rows.filter((tx) => tx.date < monthStart && tx.date <= sameDayLastMonth));
    return {
      status: "ready",
      data: {
        thisMonth: current.spending,
        lastMonthSameDay: previous.spending,
        categories: current.categories.slice(0, 3).map(({ label, total }) => ({ label, total })),
        hasTransactions: rows.length > 0
      }
    };
  };

  const memories = async (): Promise<Section<MemoryData>> => {
    const { data, error } = await supabase
      .from("content_memories")
      .select("id, content")
      .eq("user_id", user.id)
      .eq("kind", "durable")
      .eq("pinned", true)
      .order("updated_at", { ascending: false })
      .limit(3);
    if (error) throw error;
    return {
      status: "ready",
      data: { memories: ((data || []) as { id: string; content: string }[]).map((row) => ({ id: row.id, content: removeEmDashes(row.content) })) }
    };
  };

  const settle = async <T,>(name: string, run: () => Promise<Section<T>>): Promise<Section<T>> => {
    try {
      return await run();
    } catch (error) {
      console.error(`[today] ${name}`, serializeError(error));
      return { status: "error" };
    }
  };

  const [calendarSection, moneySection, memorySection] = await Promise.all([
    settle("calendar", calendar),
    settle("money", money),
    settle("memories", memories)
  ]);
  return NextResponse.json({ calendar: calendarSection, money: moneySection, memories: memorySection });
}
