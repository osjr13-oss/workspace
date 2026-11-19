import { NextResponse } from "next/server";
import { loadAccounts, summarize, type TransactionRow } from "@/lib/finance";
import { isPlaidConfigured, plaidEnvironment, syncAllIfStale } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Everything the Money page shows: connected banks (never their tokens),
 * accounts, this month and last month by category, and recent transactions.
 * Stale banks are synced first.
 */
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPlaidConfigured()) return NextResponse.json({ configured: false, environment: plaidEnvironment(), items: [], accounts: [] });

    await syncAllIfStale(user.id);

    const today = new Date();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);

    const admin = createSupabaseAdminClient();
    const [items, accounts, transactions] = await Promise.all([
      admin
        .from("plaid_items")
        .select("item_id, institution_name, status, error_code, last_synced_at, created_at")
        .eq("user_id", user.id)
        .eq("environment", plaidEnvironment())
        .order("created_at"),
      loadAccounts(supabase, user.id),
      supabase
        .from("plaid_transactions")
        .select("transaction_id, account_id, amount, date, name, merchant_name, pending, category, category_detailed")
        .eq("user_id", user.id)
        .gte("date", lastMonthStart)
        .order("date", { ascending: false })
        .limit(3000)
    ]);
    if (items.error) throw items.error;
    if (transactions.error) throw transactions.error;

    const rows = (transactions.data || []) as TransactionRow[];
    return NextResponse.json({
      configured: true,
      environment: plaidEnvironment(),
      items: items.data || [],
      accounts,
      thisMonth: { start: monthStart, ...summarize(rows.filter((tx) => tx.date >= monthStart)) },
      lastMonth: { start: lastMonthStart, ...summarize(rows.filter((tx) => tx.date < monthStart)) },
      recent: rows.slice(0, 25)
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[plaid]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
