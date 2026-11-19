import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { removeEmDashes } from "@/lib/text";

/**
 * Personal finance through Plaid (owner decision 2026-11-19): connect banks
 * with Plaid Link, then keep accounts and transactions in Selrano's database.
 *
 * Read-only: Selrano never moves money. Only the Transactions product is
 * requested; balances come from the free cached account data that every
 * transactions sync returns. There are no webhooks: data syncs when the Money
 * page opens, when chat asks about money (at most every 15 minutes), and from
 * the daily scheduled job.
 *
 * Access tokens are encrypted (lib/secret-box.ts) in `plaid_items`, which only
 * the server role can read. PLAID_ENV picks sandbox (test bank) or production.
 */

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function isPlaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidEnvironment() {
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

function baseUrl() {
  return (process.env.PLAID_BASE_URL || `https://${plaidEnvironment()}.plaid.com`).replace(/\/$/, "");
}

export class PlaidError extends Error {
  constructor(message: string, readonly code = "", readonly status = 0) {
    super(message);
  }
}

async function plaid<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error_code?: string; error_message?: string; display_message?: string };
  if (!response.ok) {
    throw new PlaidError(payload.display_message || payload.error_message || `Plaid request failed (${response.status})`, payload.error_code || "", response.status);
  }
  return payload;
}

export async function createLinkToken(userId: string, options: { itemId?: string } = {}) {
  let accessToken: string | undefined;
  if (options.itemId) accessToken = (await loadItems(userId)).find((item) => item.item_id === options.itemId)?.accessToken;
  const result = await plaid<{ link_token: string }>("/link/token/create", {
    client_name: "Selrano",
    language: "en",
    country_codes: ["US"],
    user: { client_user_id: userId },
    ...(accessToken ? { access_token: accessToken } : { products: ["transactions"], transactions: { days_requested: 730 } }),
    ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {})
  });
  return result.link_token;
}

export class DuplicateBankError extends Error {}

/** Finish connecting a bank: exchange the public token, store the encrypted access token, and pull data. */
export async function completeLink(userId: string, publicToken: string, institution: { id?: string; name?: string }) {
  // Exchanging creates a billable Item (and uses one of the Trial plan's 10), so a
  // bank that is already connected is refused before the exchange.
  if (institution.id) {
    const { data: existing } = await createSupabaseAdminClient()
      .from("plaid_items")
      .select("item_id")
      .eq("user_id", userId)
      .eq("environment", plaidEnvironment())
      .eq("institution_id", institution.id)
      .limit(1);
    if (existing?.length) throw new DuplicateBankError(`${institution.name || "That bank"} is already connected.`);
  }
  const exchanged = await plaid<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("plaid_items").upsert(
    {
      user_id: userId,
      item_id: exchanged.item_id,
      access_token_encrypted: await sealSecret(exchanged.access_token),
      institution_id: institution.id || null,
      institution_name: removeEmDashes(institution.name || "Bank"),
      environment: plaidEnvironment(),
      status: "ok",
      error_code: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "item_id" }
  );
  if (error) throw new PlaidError(`Could not save the bank connection: ${error.message}`);
  await syncItem(userId, exchanged.item_id).catch((syncError) => console.error("[plaid] first sync failed", syncError instanceof Error ? syncError.message : syncError));
  return exchanged.item_id;
}

type ItemRow = {
  item_id: string;
  institution_name: string | null;
  access_token_encrypted: string;
  cursor: string | null;
  status: string;
  error_code: string | null;
  last_synced_at: string | null;
};

async function loadItems(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plaid_items")
    .select("item_id, institution_name, access_token_encrypted, cursor, status, error_code, last_synced_at")
    .eq("user_id", userId)
    .eq("environment", plaidEnvironment());
  if (error || !data) return [];
  return Promise.all(
    (data as ItemRow[]).map(async (row) => ({ ...row, accessToken: await openSecret(row.access_token_encrypted) }))
  );
}

/** Does this account have any connected bank in the current Plaid environment? (Cheap check for chat.) */
export async function hasPlaidItems(userId: string) {
  if (!isPlaidConfigured()) return false;
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("plaid_items")
    .select("item_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("environment", plaidEnvironment());
  return !error && (count || 0) > 0;
}

type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current?: number | null; available?: number | null; limit?: number | null; iso_currency_code?: string | null };
};

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code?: string | null;
  date: string;
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  payment_channel?: string | null;
  logo_url?: string | null;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
};

type SyncPage = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  accounts?: PlaidAccount[];
  next_cursor: string;
  has_more: boolean;
};

function transactionRow(userId: string, itemId: string, tx: PlaidTransaction) {
  return {
    user_id: userId,
    item_id: itemId,
    transaction_id: tx.transaction_id,
    account_id: tx.account_id,
    amount: tx.amount,
    iso_currency_code: tx.iso_currency_code || "USD",
    date: tx.date,
    authorized_date: tx.authorized_date || null,
    name: removeEmDashes(tx.name || ""),
    merchant_name: tx.merchant_name ? removeEmDashes(tx.merchant_name) : null,
    pending: tx.pending,
    payment_channel: tx.payment_channel || null,
    logo_url: tx.logo_url || null,
    category: tx.personal_finance_category?.primary || null,
    category_detailed: tx.personal_finance_category?.detailed || null,
    updated_at: new Date().toISOString()
  };
}

/** Pull everything new for one bank with /transactions/sync, then save accounts and balances. */
export async function syncItem(userId: string, itemId: string) {
  const item = (await loadItems(userId)).find((row) => row.item_id === itemId);
  if (!item) return;
  const admin = createSupabaseAdminClient();
  let cursor = item.cursor || undefined;
  let accounts: PlaidAccount[] = [];
  try {
    for (let page = 0; page < 30; page += 1) {
      const result = await plaid<SyncPage>("/transactions/sync", { access_token: item.accessToken, cursor, count: 500 });
      const changed = [...result.added, ...result.modified].map((tx) => transactionRow(userId, itemId, tx));
      if (changed.length) {
        const { error } = await admin.from("plaid_transactions").upsert(changed, { onConflict: "transaction_id" });
        if (error) throw new PlaidError(`Could not save transactions: ${error.message}`);
      }
      if (result.removed.length) {
        await admin.from("plaid_transactions").delete().eq("user_id", userId).in("transaction_id", result.removed.map((tx) => tx.transaction_id));
      }
      if (result.accounts?.length) accounts = result.accounts;
      cursor = result.next_cursor;
      if (!result.has_more) break;
    }
    if (!accounts.length) accounts = (await plaid<{ accounts: PlaidAccount[] }>("/accounts/get", { access_token: item.accessToken })).accounts;
    if (accounts.length) {
      const { error } = await admin.from("plaid_accounts").upsert(
        accounts.map((account) => ({
          user_id: userId,
          item_id: itemId,
          account_id: account.account_id,
          name: removeEmDashes(account.name),
          official_name: account.official_name ? removeEmDashes(account.official_name) : null,
          mask: account.mask || null,
          type: account.type,
          subtype: account.subtype || null,
          current_balance: account.balances.current ?? null,
          available_balance: account.balances.available ?? null,
          credit_limit: account.balances.limit ?? null,
          iso_currency_code: account.balances.iso_currency_code || "USD",
          updated_at: new Date().toISOString()
        })),
        { onConflict: "account_id" }
      );
      if (error) throw new PlaidError(`Could not save accounts: ${error.message}`);
    }
    await admin
      .from("plaid_items")
      .update({ cursor, status: "ok", error_code: null, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("item_id", itemId)
      .eq("user_id", userId);
  } catch (error) {
    const code = error instanceof PlaidError ? error.code : "";
    await admin
      .from("plaid_items")
      .update({ status: code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error", error_code: code || "SYNC_FAILED", updated_at: new Date().toISOString() })
      .eq("item_id", itemId)
      .eq("user_id", userId);
    throw error;
  }
}

/** Sync every connected bank that has not synced recently. Errors are recorded on the bank, never thrown. */
export async function syncAllIfStale(userId: string, maxAgeMs = SYNC_INTERVAL_MS) {
  if (!isPlaidConfigured()) return;
  const items = await loadItems(userId);
  await Promise.all(
    items
      .filter((item) => !item.last_synced_at || Date.now() - new Date(item.last_synced_at).getTime() > maxAgeMs)
      .map((item) => syncItem(userId, item.item_id).catch((error) => console.error("[plaid] sync failed", { item: item.item_id, error: error instanceof Error ? error.message : error })))
  );
}

/** Daily job: sync every account's banks. */
export async function syncEveryone() {
  if (!isPlaidConfigured()) return { synced: 0 };
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plaid_items").select("user_id").eq("environment", plaidEnvironment());
  const users = Array.from(new Set(((data || []) as Array<{ user_id: string }>).map((row) => row.user_id)));
  for (const userId of users) await syncAllIfStale(userId, 60 * 60 * 1000);
  return { synced: users.length };
}

/** Disconnect a bank at Plaid and delete its stored data. (On a Trial plan this does not free a connection slot.) */
export async function removeItem(userId: string, itemId: string) {
  const item = (await loadItems(userId)).find((row) => row.item_id === itemId);
  if (!item) return;
  try {
    await plaid("/item/remove", { access_token: item.accessToken });
  } catch (error) {
    console.error("[plaid] item remove failed", error instanceof Error ? error.message : error);
  }
  const admin = createSupabaseAdminClient();
  await admin.from("plaid_transactions").delete().eq("user_id", userId).eq("item_id", itemId);
  await admin.from("plaid_accounts").delete().eq("user_id", userId).eq("item_id", itemId);
  await admin.from("plaid_items").delete().eq("user_id", userId).eq("item_id", itemId);
}

type RecurringStream = {
  description: string;
  merchant_name?: string | null;
  frequency: string;
  average_amount?: { amount?: number | null } | null;
  last_amount?: { amount?: number | null } | null;
  last_date?: string | null;
  predicted_next_date?: string | null;
  is_active: boolean;
  status?: string;
  personal_finance_category?: { primary?: string } | null;
};

/** Subscriptions and bills across connected banks, from Plaid's recurring transaction detection. */
export async function recurringPayments(userId: string) {
  const items = await loadItems(userId);
  const streams: Array<RecurringStream & { institution: string | null }> = [];
  for (const item of items) {
    try {
      const result = await plaid<{ outflow_streams: RecurringStream[] }>("/transactions/recurring/get", { access_token: item.accessToken });
      for (const stream of result.outflow_streams || []) if (stream.is_active) streams.push({ ...stream, institution: item.institution_name });
    } catch (error) {
      console.error("[plaid] recurring failed", error instanceof Error ? error.message : error);
    }
  }
  return streams
    .map((stream) => ({
      name: removeEmDashes(stream.merchant_name || stream.description),
      frequency: stream.frequency.toLowerCase(),
      amount: Math.abs(stream.last_amount?.amount ?? stream.average_amount?.amount ?? 0),
      lastDate: stream.last_date || null,
      nextDate: stream.predicted_next_date || null,
      category: stream.personal_finance_category?.primary || null,
      institution: stream.institution
    }))
    .sort((a, b) => b.amount - a.amount);
}
