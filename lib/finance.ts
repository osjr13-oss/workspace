import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reading the owner's synced finance data (plaid_accounts, plaid_transactions)
 * for chat tools and the Money page. Plaid amounts are positive for money out
 * and negative for money in. Transfers between the owner's own accounts and
 * credit card payments are left out of spending so nothing is counted twice.
 */

export type TransactionRow = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category: string | null;
  category_detailed: string | null;
};

export type AccountRow = {
  account_id: string;
  item_id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  iso_currency_code: string | null;
  updated_at: string;
};

const NOT_SPENDING_PRIMARY = new Set(["TRANSFER_IN", "TRANSFER_OUT", "INCOME"]);
const NOT_SPENDING_DETAILED = new Set(["LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"]);

export function isSpending(tx: Pick<TransactionRow, "amount" | "category" | "category_detailed">) {
  return tx.amount > 0 && !NOT_SPENDING_PRIMARY.has(tx.category || "") && !NOT_SPENDING_DETAILED.has(tx.category_detailed || "");
}

export function isIncome(tx: Pick<TransactionRow, "amount" | "category">) {
  return tx.amount < 0 && tx.category === "INCOME";
}

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_AND_DRINK: "Food and drink",
  GENERAL_MERCHANDISE: "Shopping",
  GENERAL_SERVICES: "Services",
  RENT_AND_UTILITIES: "Rent and utilities",
  TRANSPORTATION: "Transportation",
  TRAVEL: "Travel",
  ENTERTAINMENT: "Entertainment",
  PERSONAL_CARE: "Personal care",
  MEDICAL: "Medical",
  HOME_IMPROVEMENT: "Home",
  LOAN_PAYMENTS: "Loan payments",
  BANK_FEES: "Bank fees",
  GOVERNMENT_AND_NON_PROFIT: "Taxes and donations",
  INCOME: "Income",
  TRANSFER_IN: "Transfers in",
  TRANSFER_OUT: "Transfers out",
  OTHER: "Other"
};

export function categoryLabel(category: string | null) {
  if (!category) return "Other";
  return CATEGORY_LABELS[category] || category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, " ");
}

export function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function isoDate(value: string, fallback: string) {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value || "");
  return match ? match[0] : fallback;
}

async function transactionsBetween(supabase: SupabaseClient, userId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("plaid_transactions")
    .select("transaction_id, account_id, amount, date, name, merchant_name, pending, category, category_detailed")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data || []) as TransactionRow[];
}

export async function loadAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("plaid_accounts")
    .select("account_id, item_id, name, mask, type, subtype, current_balance, available_balance, credit_limit, iso_currency_code, updated_at")
    .eq("user_id", userId)
    .order("type")
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []) as AccountRow[];
}

export function summarize(transactions: TransactionRow[]) {
  const byCategory = new Map<string, number>();
  let spending = 0;
  let income = 0;
  for (const tx of transactions) {
    if (isSpending(tx)) {
      spending += tx.amount;
      byCategory.set(tx.category || "OTHER", (byCategory.get(tx.category || "OTHER") || 0) + tx.amount);
    } else if (isIncome(tx)) {
      income += -tx.amount;
    }
  }
  const categories = [...byCategory.entries()].map(([category, total]) => ({ category, label: categoryLabel(category), total })).sort((a, b) => b.total - a.total);
  return { spending, income, categories };
}

// ----------------------------------------------------------- Chat tools --

/** Spending by category and income between two dates. */
export async function spendingSummaryText(supabase: SupabaseClient, userId: string, startRaw: string, endRaw: string) {
  const today = new Date().toISOString().slice(0, 10);
  const start = isoDate(startRaw, today.slice(0, 8) + "01");
  const end = isoDate(endRaw, today);
  const transactions = await transactionsBetween(supabase, userId, start, end);
  if (!transactions.length) return `No transactions between ${start} and ${end}.`;
  const { spending, income, categories } = summarize(transactions);
  return [
    `From ${start} to ${end}: spent ${money(spending)}, income ${money(income)} (transfers between own accounts and credit card payments excluded).`,
    ...categories.map((item) => `- ${item.label}: ${money(item.total)}`)
  ].join("\n");
}

/** Matching transactions, newest first. */
export async function findTransactionsText(
  supabase: SupabaseClient,
  userId: string,
  args: { query?: string; category?: string; start?: string; end?: string; min_amount?: number }
) {
  const today = new Date().toISOString().slice(0, 10);
  const start = isoDate(args.start || "", new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  const end = isoDate(args.end || "", today);
  const query = (args.query || "").trim().toLowerCase();
  const category = (args.category || "").trim().toLowerCase();
  const accounts = new Map((await loadAccounts(supabase, userId)).map((account) => [account.account_id, account]));
  const matches = (await transactionsBetween(supabase, userId, start, end)).filter((tx) => {
    if (query && !`${tx.merchant_name || ""} ${tx.name}`.toLowerCase().includes(query)) return false;
    if (category && !`${tx.category || ""} ${categoryLabel(tx.category)} ${tx.category_detailed || ""}`.toLowerCase().includes(category)) return false;
    if (typeof args.min_amount === "number" && Math.abs(tx.amount) < args.min_amount) return false;
    return true;
  });
  if (!matches.length) return `No matching transactions between ${start} and ${end}.`;
  const total = matches.reduce((sum, tx) => sum + tx.amount, 0);
  return [
    `${matches.length} matching transactions from ${start} to ${end}; net ${money(total)} out (negative means money in). Newest first:`,
    ...matches.slice(0, 40).map((tx) => {
      const account = accounts.get(tx.account_id);
      const where = account ? ` (${account.name}${account.mask ? ` ${account.mask}` : ""})` : "";
      return `- ${tx.date}: ${tx.merchant_name || tx.name} ${money(Math.abs(tx.amount))} ${tx.amount < 0 ? "in" : "out"}, ${categoryLabel(tx.category)}${tx.pending ? ", pending" : ""}${where}`;
    }),
    ...(matches.length > 40 ? [`(${matches.length - 40} more not shown)`] : [])
  ].join("\n");
}

export async function accountsText(supabase: SupabaseClient, userId: string) {
  const accounts = await loadAccounts(supabase, userId);
  if (!accounts.length) return "No bank accounts are connected yet.";
  return [
    "Balances as last reported by the bank:",
    ...accounts.map((account) => {
      const balance = account.current_balance ?? 0;
      const currency = account.iso_currency_code || "USD";
      const detail =
        account.type === "credit"
          ? `owed ${money(balance, currency)}${account.credit_limit ? ` of a ${money(account.credit_limit, currency)} limit` : ""}`
          : `${money(balance, currency)}${account.available_balance !== null && account.available_balance !== balance ? `, ${money(account.available_balance, currency)} available` : ""}`;
      return `- ${account.name}${account.mask ? ` ${account.mask}` : ""} (${account.subtype || account.type}): ${detail}`;
    })
  ].join("\n");
}
