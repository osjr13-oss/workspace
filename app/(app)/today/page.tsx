"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MessageCircle, Plus, Star, Trash2 } from "lucide-react";
import { AddFoodSheet } from "@/components/add-food-sheet";
import { CalorieRing, MacroBar } from "@/components/charts";
import { useRequireProfile } from "@/components/health-provider";
import { WeightQuickLog } from "@/components/weight-quick-log";
import { addDays, formatDay } from "@/lib/dates";
import { describeAmount, hourIn, MEAL_LABELS, mealForHour, MEALS, recentFoods, toDraft, totals, type FoodEntry, type Meal, type SavedMeal } from "@/lib/food-log";
import { deleteEntry, loadDayComplete, loadEntries, loadRecentEntries, loadSavedMeals, saveMeal, setDayComplete } from "@/lib/food-log-client";
import { CALORIE_FLOOR } from "@/lib/targets";

export default function TodayPage() {
  const { ready, profile, target, today } = useRequireProfile();
  const [day, setDay] = useState(today);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [week, setWeek] = useState<FoodEntry[]>([]);
  const [recent, setRecent] = useState<FoodEntry[]>([]);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [complete, setComplete] = useState(false);
  const [sheetMeal, setSheetMeal] = useState<Meal | null>(null);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => setDay(today), [today]);

  const load = useCallback(async () => {
    try {
      const [weekRows, recentRows, savedRows, done] = await Promise.all([
        loadEntries(addDays(day, -6), day),
        loadRecentEntries(),
        loadSavedMeals(),
        loadDayComplete(day)
      ]);
      setWeek(weekRows);
      setEntries(weekRows.filter((entry) => entry.local_date === day));
      setRecent(recentRows);
      setSaved(savedRows);
      setComplete(done);
      setError("");
    } catch {
      setError("Could not load your log. Check your connection and try again.");
    }
  }, [day]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const eaten = totals(entries);
  const recents = useMemo(() => recentFoods(recent), [recent]);

  // Several logged days well under the safe minimum get a plain, non-judging note.
  const lowDays = useMemo(() => {
    if (!profile) return 0;
    const floor = CALORIE_FLOOR[profile.sex_for_calc];
    const byDay = new Map<string, number>();
    for (const entry of week) byDay.set(entry.local_date, (byDay.get(entry.local_date) || 0) + Number(entry.kcal));
    return [...byDay.entries()].filter(([date, kcal]) => date !== today && kcal > 0 && kcal < floor * 0.85).length;
  }, [week, profile, today]);

  if (!ready || !profile) return <div className="grid min-h-[60vh] place-items-center"><div className="status-pill">Loading</div></div>;

  const isToday = day === today;
  const dayLabel = isToday ? "Today" : day === addDays(today, -1) ? "Yesterday" : formatDay(day);

  async function remove(entry: FoodEntry) {
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    try {
      await deleteEntry(entry.id);
      void load();
    } catch {
      setError("Could not remove that item.");
      void load();
    }
  }

  async function favorite(meal: Meal) {
    const items = entries.filter((entry) => entry.meal === meal);
    if (!items.length) return;
    const name = items.length === 1 ? items[0].name : `${MEAL_LABELS[meal]}: ${items.map((item) => item.name).slice(0, 3).join(", ")}`;
    try {
      await saveMeal(name, items.map(toDraft));
      setSavedNote(`Saved "${name}". Find it under Saved when adding food.`);
      void load();
    } catch {
      setError("Could not save that meal.");
    }
  }

  async function toggleComplete() {
    const next = !complete;
    setComplete(next);
    try {
      await setDayComplete(day, next);
    } catch {
      setComplete(!next);
      setError("Could not update the day.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 sm:px-6 lg:pt-10">
      <header className="flex items-center gap-2">
        <button type="button" className="icon-button" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-2xl font-extrabold tracking-[-0.03em] sm:text-left sm:text-3xl">{dayLabel}</h1>
        <button type="button" className="icon-button" aria-label="Next day" disabled={isToday} onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight size={18} />
        </button>
      </header>

      {error ? <p className="text-sm font-bold text-[var(--critical)]" role="alert">{error}</p> : null}

      <section className="panel flex flex-col items-center gap-6 p-5 sm:flex-row sm:p-6" aria-label="Day summary">
        {target ? <CalorieRing eaten={eaten.kcal} target={target.calories} /> : null}
        <div className="w-full flex-1 space-y-3">
          <p className="text-sm text-[var(--muted-strong)]">
            <span className="font-extrabold text-[var(--text)] tabular-nums">{eaten.kcal.toLocaleString()}</span> eaten
            {target ? <> of <span className="tabular-nums">{target.calories.toLocaleString()}</span> kcal</> : null}
          </p>
          {target ? (
            <>
              <MacroBar label="Protein" value={eaten.protein_g} target={target.protein_g} />
              <MacroBar label="Carbs" value={eaten.carbs_g} target={target.carbs_g} />
              <MacroBar label="Fat" value={eaten.fat_g} target={target.fat_g} />
            </>
          ) : null}
        </div>
      </section>

      {lowDays >= 3 ? (
        <p className="panel p-4 text-sm leading-6 text-[var(--muted-strong)]">
          A few recent days were logged well under your minimum. Eating too little tends to backfire on energy, mood and progress. If those days were not fully logged, no problem. If they were, it is worth a word with your coach.
        </p>
      ) : null}

      <div className="space-y-3">
        {MEALS.map((meal) => {
          const items = entries.filter((entry) => entry.meal === meal);
          const sum = totals(items);
          return (
            <section key={meal} className="panel p-4" aria-label={MEAL_LABELS[meal]}>
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-base font-extrabold">{MEAL_LABELS[meal]}</h2>
                {items.length ? <span className="text-sm font-bold tabular-nums text-[var(--muted-strong)]">{sum.kcal} kcal</span> : null}
                {items.length ? (
                  <button type="button" className="icon-button" aria-label={`Save ${MEAL_LABELS[meal].toLowerCase()} as a favorite`} title="Save as a favorite" onClick={() => favorite(meal)}>
                    <Star size={16} />
                  </button>
                ) : null}
                <button type="button" className="pill-button" onClick={() => setSheetMeal(meal)} aria-label={`Add to ${MEAL_LABELS[meal].toLowerCase()}`}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {items.length ? (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {items.map((entry) => (
                    <li key={entry.id} className="group flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{entry.name}</span>
                        <span className="block truncate text-[12px] text-[var(--muted)]">
                          {describeAmount(entry)}
                          {entry.confidence && entry.source.startsWith("ai_") ? ", estimate" : ""}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums">{Math.round(Number(entry.kcal))}</span>
                      <button type="button" className="icon-button opacity-60 hover:opacity-100" aria-label={`Remove ${entry.name}`} onClick={() => remove(entry)}>
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
      {savedNote ? <p className="text-sm text-[var(--muted-strong)]" role="status">{savedNote}</p> : null}

      <WeightQuickLog day={day} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={`pill-button ${complete ? "pill-button-active" : ""}`} aria-pressed={complete} onClick={toggleComplete}>
          <Check size={14} /> {complete ? "Day fully logged" : "Mark day as fully logged"}
        </button>
        <Link href="/chats" className="pill-button">
          <MessageCircle size={14} /> Ask your coach
        </Link>
      </div>

      <button type="button" className="fab" onClick={() => setSheetMeal(isToday ? mealForHour(hourIn(profile.timezone)) : "snack")}>
        <Plus size={20} /> Add food
      </button>

      {sheetMeal ? (
        <AddFoodSheet
          day={day}
          initialMeal={sheetMeal}
          recents={recents}
          saved={saved}
          onClose={() => setSheetMeal(null)}
          onLogged={() => void load()}
        />
      ) : null}
    </div>
  );
}
