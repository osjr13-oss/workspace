"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, PencilLine, ScanLine, Search, Star, X } from "lucide-react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import type { FoodResult, Serving } from "@/lib/food-db";
import { describeAmount, draftFromFood, MEAL_LABELS, MEALS, type EntryDraft, type Meal, type SavedMeal } from "@/lib/food-log";
import { logEntries, markSavedMealUsed } from "@/lib/food-log-client";

type Tab = "search" | "scan" | "recent" | "saved" | "manual";

const TABS: Array<{ id: Tab; label: string; icon: typeof Search }> = [
  { id: "search", label: "Search", icon: Search },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "saved", label: "Saved", icon: Star },
  { id: "manual", label: "By hand", icon: PencilLine }
];

/** Everything for adding food to a day: search, barcode, recents, saved meals and manual entry. */
export function AddFoodSheet({
  day,
  initialMeal,
  recents,
  saved,
  onClose,
  onLogged
}: {
  day: string;
  initialMeal: Meal;
  recents: EntryDraft[];
  saved: SavedMeal[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [tab, setTab] = useState<Tab>(recents.length ? "recent" : "search");
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [picked, setPicked] = useState<FoodResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function log(drafts: EntryDraft[], label: string) {
    setBusy(true);
    setError("");
    try {
      await logEntries(day, meal, drafts);
      setToast(`Added ${label} to ${MEAL_LABELS[meal].toLowerCase()}`);
      setPicked(null);
      onLogged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not add that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function lookUp(code: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/foods/barcode/${code}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Barcode lookup failed.");
      setPicked(payload.food as FoodResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Barcode lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add food">
      <button type="button" aria-label="Close" className="drawer-scrim absolute inset-0" onClick={onClose} />
      <div className="sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col">
        <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          {picked ? (
            <button type="button" className="icon-button" aria-label="Back to results" onClick={() => setPicked(null)}>
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <h2 className="flex-1 text-base font-extrabold">Add food</h2>
          <label className="sr-only" htmlFor="add-food-meal">Meal</label>
          <select id="add-food-meal" className="meal-select" value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>
            {MEALS.map((value) => (
              <option key={value} value={value}>{MEAL_LABELS[value]}</option>
            ))}
          </select>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {!picked ? (
          <nav className="flex gap-1 overflow-x-auto px-3 pt-3" aria-label="Ways to add food">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={`tab-chip ${tab === id ? "tab-chip-active" : ""}`} aria-pressed={tab === id} onClick={() => { setTab(id); setError(""); }}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {toast ? <p className="mb-3 rounded-xl bg-[var(--surface-subtle)] px-3 py-2 text-sm font-bold" role="status">{toast}</p> : null}
          {error ? <p className="mb-3 text-sm font-bold text-[var(--critical)]" role="alert">{error}</p> : null}
          {picked ? (
            <PortionPicker food={picked} busy={busy} onAdd={(draft) => log([draft], picked.name)} />
          ) : tab === "search" ? (
            <FoodSearch onPick={setPicked} />
          ) : tab === "scan" ? (
            <BarcodeScanner onCode={lookUp} busy={busy} />
          ) : tab === "recent" ? (
            <DraftList
              empty="Foods you log show up here for one-tap adding."
              items={recents.map((draft) => ({ key: `${draft.name}|${draft.unit}|${draft.quantity}`, title: draft.name, detail: describe(draft), kcal: draft.kcal, onAdd: () => log([draft], draft.name) }))}
              busy={busy}
            />
          ) : tab === "saved" ? (
            <DraftList
              empty="Save a meal from Today to add it again with one tap."
              items={saved.map((item) => ({
                key: item.id,
                title: item.name,
                detail: item.items.map((draft) => draft.name).join(", "),
                kcal: item.items.reduce((sum, draft) => sum + Number(draft.kcal), 0),
                onAdd: async () => {
                  await log(item.items, item.name);
                  void markSavedMealUsed(item);
                }
              }))}
              busy={busy}
            />
          ) : (
            <ManualEntry busy={busy} onAdd={(draft) => log([draft], draft.name)} />
          )}
        </div>
      </div>
    </div>
  );
}

function describe(draft: EntryDraft) {
  const amount = describeAmount(draft);
  return draft.brand ? `${draft.brand}, ${amount}` : amount;
}

function FoodSearch({ onPick }: { onPick: (food: FoodResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const request = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(term)}`);
        const payload = await response.json().catch(() => ({}));
        if (id !== request.current) return;
        if (!response.ok) throw new Error(payload.error || "Search failed.");
        setResults(payload.foods || []);
        setState("done");
      } catch (failure) {
        if (id !== request.current) return;
        setMessage(failure instanceof Error ? failure.message : "Search failed.");
        setState("error");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-elevated)] px-4">
        <Search size={16} className="shrink-0 text-[var(--muted)]" />
        <input autoFocus aria-label="Search foods" placeholder="Search foods, e.g. banana" className="min-h-11 w-full bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {state === "loading" ? <p className="text-sm text-[var(--muted)]">Searching...</p> : null}
      {state === "error" ? <p className="text-sm text-[var(--critical)]">{message}</p> : null}
      {state === "done" && !results.length ? <p className="text-sm text-[var(--muted)]">Nothing found. Try a simpler name, or add it by hand.</p> : null}
      <ul className="space-y-1">
        {results.map((food) => (
          <li key={food.id}>
            <button type="button" className="food-row w-full" onClick={() => onPick(food)}>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-bold">{food.name}</span>
                <span className="block truncate text-[13px] text-[var(--muted)]">{food.brand ? `${food.brand}, ` : ""}{Math.round(food.kcal_100g)} kcal per 100 g</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {results.length ? <p className="text-[11px] text-[var(--muted)]">Data from USDA FoodData Central.</p> : null}
    </div>
  );
}

function PortionPicker({ food, busy, onAdd }: { food: FoodResult; busy: boolean; onAdd: (draft: EntryDraft) => void }) {
  const servings: Serving[] = [...food.servings, { label: "g", grams: 1 }];
  const [servingIndex, setServingIndex] = useState(food.servings.length ? 0 : servings.length - 1);
  const serving = servings[servingIndex];
  const [quantity, setQuantity] = useState(serving.grams === 1 ? "100" : "1");
  const amount = Number(quantity) > 0 ? Number(quantity) : 0;
  const draft = draftFromFood(food, serving, amount);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold">{food.name}</h3>
        {food.brand ? <p className="text-sm text-[var(--muted)]">{food.brand}</p> : null}
      </div>
      <div className="flex gap-2">
        <label className="w-28">
          <span className="field-label">Amount</span>
          <input aria-label="Amount" inputMode="decimal" className="input-premium mt-2 w-full px-4" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <label className="min-w-0 flex-1">
          <span className="field-label">Unit</span>
          <select
            aria-label="Unit"
            className="input-premium mt-2 w-full px-4"
            value={servingIndex}
            onChange={(event) => {
              const next = Number(event.target.value);
              setServingIndex(next);
              setQuantity(servings[next].grams === 1 ? "100" : "1");
            }}
          >
            {servings.map((option, index) => (
              <option key={`${option.label}-${index}`} value={index}>{option.grams === 1 ? "grams" : `${option.label} (${option.grams} g)`}</option>
            ))}
          </select>
        </label>
      </div>
      <Nutrition draft={draft} />
      <button type="button" className="btn-primary w-full" disabled={busy || amount <= 0} onClick={() => onAdd(draft)}>
        {busy ? "Adding..." : `Add ${Math.round(draft.kcal)} kcal`}
      </button>
      {food.source === "off" ? <p className="text-[11px] text-[var(--muted)]">Data from Open Food Facts (ODbL).</p> : null}
    </div>
  );
}

function ManualEntry({ busy, onAdd }: { busy: boolean; onAdd: (draft: EntryDraft) => void }) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const value = (text: string) => (Number(text) >= 0 ? Number(text) : 0);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !(Number(kcal) >= 0) || kcal === "") return;
        onAdd({ name: name.trim(), brand: null, quantity: 1, unit: "serving", grams: null, kcal: value(kcal), protein_g: value(protein), carbs_g: value(carbs), fat_g: value(fat), fiber_g: null, source: "manual", food_id: null });
      }}
    >
      <label className="block">
        <span className="field-label">Food</span>
        <input aria-label="Food name" className="input-premium mt-2 w-full px-5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Homemade soup" required />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Calories", kcal, setKcal],
          ["Protein g", protein, setProtein],
          ["Carbs g", carbs, setCarbs],
          ["Fat g", fat, setFat]
        ].map(([label, current, set]) => (
          <label key={label as string} className="block">
            <span className="field-label">{label as string}</span>
            <input aria-label={label as string} inputMode="decimal" className="input-premium mt-2 w-full px-4" value={current as string} onChange={(event) => (set as (v: string) => void)(event.target.value)} />
          </label>
        ))}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy || !name.trim() || kcal === ""}>
        {busy ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function DraftList({ items, empty, busy }: { items: Array<{ key: string; title: string; detail: string; kcal: number; onAdd: () => void }>; empty: string; busy: boolean }) {
  if (!items.length) return <p className="text-sm text-[var(--muted)]">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key} className="food-row">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{item.title}</span>
            <span className="block truncate text-[13px] text-[var(--muted)]">{item.detail}</span>
          </span>
          <span className="text-sm font-bold tabular-nums">{Math.round(item.kcal)}</span>
          <button type="button" className="pill-button" disabled={busy} onClick={item.onAdd} aria-label={`Add ${item.title}`}>Add</button>
        </li>
      ))}
    </ul>
  );
}

export function Nutrition({ draft }: { draft: Pick<EntryDraft, "kcal" | "protein_g" | "carbs_g" | "fat_g"> }) {
  return (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {[
        ["kcal", draft.kcal],
        ["protein", draft.protein_g],
        ["carbs", draft.carbs_g],
        ["fat", draft.fat_g]
      ].map(([label, value]) => (
        <div key={label as string} className="rounded-xl bg-[var(--surface-subtle)] px-2 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{label as string}</dt>
          <dd className="text-base font-extrabold tabular-nums">{Math.round(Number(value))}{label === "kcal" ? "" : " g"}</dd>
        </div>
      ))}
    </dl>
  );
}

