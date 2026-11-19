"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Plus, RefreshCw, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceHeader } from "@/components/workspace-header";
import { formatRelative } from "@/lib/format";

type Item = { item_id: string; institution_name: string | null; status: string; error_code: string | null; last_synced_at: string | null };
type Account = {
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
};
type Summary = { start: string; spending: number; income: number; categories: Array<{ category: string; label: string; total: number }> };
type Transaction = { transaction_id: string; date: string; name: string; merchant_name: string | null; amount: number; pending: boolean; category: string | null };
type Overview = {
  configured: boolean;
  environment: "sandbox" | "production";
  items: Item[];
  accounts: Account[];
  thisMonth?: Summary;
  lastMonth?: Summary;
  recent?: Transaction[];
  error?: string;
};
type Recurring = { name: string; frequency: string; amount: number; nextDate: string | null; lastDate: string | null };

type PlaidHandler = { open: () => void };
type PlaidGlobal = {
  create: (config: {
    token: string;
    onSuccess: (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => void;
    onExit: (error: { display_message?: string; error_message?: string } | null) => void;
  }) => PlaidHandler;
};

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaid(): Promise<PlaidGlobal> {
  const existing = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLAID_SCRIPT;
    script.async = true;
    script.onload = () => {
      const plaid = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
      if (plaid) resolve(plaid);
      else reject(new Error("Plaid did not load."));
    };
    script.onerror = () => reject(new Error("Plaid could not be loaded. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function monthName(start?: string) {
  return start ? new Date(`${start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) : "";
}

export default function MoneyPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recurring, setRecurring] = useState<Recurring[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/plaid");
      const payload = (await response.json()) as Overview;
      if (!response.ok) throw new Error(payload.error || "Could not load your money.");
      setOverview(payload);
      if (payload.items.length) {
        fetch("/api/plaid/recurring")
          .then((result) => result.json())
          .then((data: { recurring?: Recurring[] }) => setRecurring(data.recurring || []))
          .catch(() => setRecurring([]));
      } else {
        setRecurring([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load your money.");
      setOverview((current) => current ?? { configured: false, environment: "sandbox", items: [], accounts: [] });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(itemId?: string) {
    setBusy(itemId || "connect");
    setMessage("");
    try {
      const tokenResponse = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {})
      });
      const tokenPayload = (await tokenResponse.json()) as { linkToken?: string; error?: string };
      if (!tokenResponse.ok || !tokenPayload.linkToken) throw new Error(tokenPayload.error || "Could not start connecting a bank.");
      const plaid = await loadPlaid();
      await new Promise<void>((resolve, reject) => {
        const handler = plaid.create({
          token: tokenPayload.linkToken!,
          onSuccess: async (publicToken, metadata) => {
            try {
              setMessage(itemId ? "Refreshing your bank…" : "Bringing in your accounts and transactions. This can take a minute…");
              const response = await fetch(itemId ? `/api/plaid/items/${itemId}` : "/api/plaid/exchange", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicToken, institution: { id: metadata.institution?.institution_id, name: metadata.institution?.name } })
              });
              const payload = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(payload.error || "Could not save the bank connection.");
              setMessage(itemId ? "Your bank is working again." : "Bank connected.");
              await load();
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onExit: (error) => (error ? reject(new Error(error.display_message || error.error_message || "Connecting the bank stopped.")) : resolve())
        });
        handler.open();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect the bank.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(item: Item) {
    const confirmed = window.confirm(
      `Disconnect ${item.institution_name || "this bank"}? Its accounts and transactions will be removed from Selrano.\n\nOn Plaid's free plan, a disconnected bank still uses one of your 10 connections.`
    );
    if (!confirmed) return;
    setBusy(item.item_id);
    setMessage("");
    try {
      const response = await fetch(`/api/plaid/items/${item.item_id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not disconnect the bank.");
      setMessage(`${item.institution_name || "The bank"} is disconnected.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect the bank.");
    } finally {
      setBusy(null);
    }
  }

  const connectButton = (
    <button type="button" className="btn-primary" onClick={() => connect()} disabled={Boolean(busy) || !overview?.configured}>
      <Plus size={17} />
      {busy === "connect" ? "Connecting" : "Connect a bank"}
    </button>
  );

  const items = overview?.items || [];
  const month = overview?.thisMonth;
  const last = overview?.lastMonth;
  const topCategory = month?.categories[0]?.total || 1;
  const monthlyRecurring = (recurring || []).reduce((sum, item) => sum + perMonth(item.amount, item.frequency), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Money" eyebrow="Workspace" description="Your banks and cards in one place. Ask about any of it in chat, like how much you spent on food last month.">
        {overview?.configured && items.length ? connectButton : null}
      </WorkspaceHeader>

      {overview?.environment === "sandbox" && overview.configured ? (
        <p className="text-sm text-[var(--muted-strong)]">Test mode: banks connected here use Plaid&apos;s sample data, not your real accounts.</p>
      ) : null}

      {message ? (
        <p role="status" className="text-sm font-medium text-[var(--muted-strong)]">
          {message}
        </p>
      ) : null}

      {!overview ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : !overview.configured ? (
        <EmptyState icon={<Wallet size={20} />} title="Plaid is not set up yet" description="Once Plaid is set up on the server, you can connect your banks and cards here." />
      ) : !items.length ? (
        <EmptyState
          icon={<Wallet size={20} />}
          title="Connect your first bank"
          description="Selrano reads balances and transactions through Plaid. It can never move money. You can connect up to 10 bank logins on Plaid's free plan."
          action={connectButton}
        />
      ) : (
        <>
          <section aria-label="This month" className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
            <Figure label={`Spent in ${monthName(month?.start)}`} value={money(month?.spending || 0)} note={last ? `${money(last.spending)} in ${monthName(last.start)}` : ""} />
            <Figure label={`Income in ${monthName(month?.start)}`} value={money(month?.income || 0)} note={last ? `${money(last.income)} in ${monthName(last.start)}` : ""} />
            <Figure
              label="Subscriptions and bills"
              value={recurring ? `${money(monthlyRecurring)} a month` : "…"}
              note={recurring ? `${recurring.length} recurring payment${recurring.length === 1 ? "" : "s"}` : "Finding them"}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <section className="panel p-6" aria-label="Spending by category">
              <h2 className="text-base font-semibold tracking-[-0.01em]">Where it went in {monthName(month?.start)}</h2>
              {month?.categories.length ? (
                <ul className="mt-5 space-y-3.5">
                  {month.categories.map((item) => (
                    <li key={item.category}>
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="tabular-nums text-[var(--muted-strong)]">{money(item.total)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(2, (item.total / topCategory) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">No spending yet this month.</p>
              )}
            </section>

            <section className="panel p-6" aria-label="Accounts">
              <h2 className="text-base font-semibold tracking-[-0.01em]">Accounts</h2>
              <ul className="mt-4 space-y-5">
                {items.map((item) => (
                  <li key={item.item_id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                        <Landmark size={15} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                        <span className="truncate">{item.institution_name || "Bank"}</span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.status === "login_required" ? (
                          <button type="button" className="btn-secondary btn-sm" onClick={() => connect(item.item_id)} disabled={Boolean(busy)}>
                            <RefreshCw size={14} /> Sign in again
                          </button>
                        ) : null}
                        <button type="button" className="btn-ghost btn-sm" onClick={() => disconnect(item)} disabled={Boolean(busy)} aria-label={`Disconnect ${item.institution_name || "bank"}`}>
                          Disconnect
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                      {item.status === "login_required"
                        ? "Needs you to sign in again before it can update."
                        : item.status === "error"
                          ? "Could not update last time. Selrano will keep trying."
                          : item.last_synced_at
                            ? `Updated ${formatRelative(item.last_synced_at)}`
                            : "Waiting for the first update"}
                    </p>
                    <ul className="mt-2 divide-y divide-[var(--border)]">
                      {(overview.accounts || [])
                        .filter((account) => account.item_id === item.item_id)
                        .map((account) => (
                          <li key={account.account_id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                            <span className="min-w-0 truncate">
                              {account.name}
                              {account.mask ? <span className="text-[var(--muted)]"> {account.mask}</span> : null}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {account.type === "credit" ? `${money(account.current_balance || 0, account.iso_currency_code || "USD")} owed` : money(account.current_balance || 0, account.iso_currency_code || "USD")}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel p-6" aria-label="Subscriptions and bills">
              <h2 className="text-base font-semibold tracking-[-0.01em]">Subscriptions and bills</h2>
              {!recurring ? (
                <p className="mt-4 text-sm text-[var(--muted)]">Finding recurring payments…</p>
              ) : recurring.length ? (
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {recurring.map((item) => (
                    <li key={`${item.name}-${item.amount}`} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="block text-[12.5px] text-[var(--muted)]">
                          {item.frequency.replace(/_/g, " ")}
                          {item.nextDate ? `, next around ${new Date(`${item.nextDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{money(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">None found yet. Plaid needs a few months of history to spot recurring payments.</p>
              )}
            </section>

            <section className="panel p-6" aria-label="Recent transactions">
              <h2 className="text-base font-semibold tracking-[-0.01em]">Recent transactions</h2>
              {overview.recent?.length ? (
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {overview.recent.map((tx) => (
                    <li key={tx.transaction_id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tx.merchant_name || tx.name}</span>
                        <span className="block text-[12.5px] text-[var(--muted)]">
                          {new Date(`${tx.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                          {tx.pending ? ", pending" : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${tx.amount < 0 ? "text-[var(--low)]" : ""}`}>
                        {tx.amount < 0 ? `+${money(-tx.amount)}` : money(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">Transactions appear here after the first update.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-[var(--surface)] px-5 py-4">
      <p className="text-[13px] text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-[28px] leading-tight tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}

function perMonth(amount: number, frequency: string) {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "semi_monthly":
      return amount * 2;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
}
