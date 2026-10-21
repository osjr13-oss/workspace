import { addDays, daysBetween } from "@/lib/dates";

/**
 * A smoothed weight trend. Daily weight swings by a kilogram or more with
 * water and food, so progress is read from an exponentially smoothed line
 * (each day moves 10% of the way toward that day's weigh-in), not raw numbers.
 */

export type WeighIn = { local_date: string; weight_kg: number };
export type TrendPoint = { date: string; weight: number | null; trend: number };

export const TREND_SMOOTHING = 0.1;

/** One point per calendar day from the first weigh-in to `through`, carrying the trend over gaps. */
export function weightTrend(entries: WeighIn[], through: string): TrendPoint[] {
  if (!entries.length) return [];
  // Several weigh-ins on one day count as their average.
  const byDay = new Map<string, number[]>();
  for (const entry of entries) {
    byDay.set(entry.local_date, [...(byDay.get(entry.local_date) || []), Number(entry.weight_kg)]);
  }
  const days = [...byDay.keys()].sort();
  const points: TrendPoint[] = [];
  let trend: number | null = null;
  for (let day = days[0]; day <= through; day = addDays(day, 1)) {
    const values = byDay.get(day);
    const weight = values ? values.reduce((a, b) => a + b, 0) / values.length : null;
    if (weight !== null) trend = trend === null ? weight : trend + TREND_SMOOTHING * (weight - trend);
    points.push({ date: day, weight, trend: Math.round((trend as number) * 100) / 100 });
  }
  return points;
}

/** Trend change per week over the last `days` days, by least squares; null without enough data. */
export function weeklyRate(points: TrendPoint[], days = 28): number | null {
  const recent = points.slice(-days);
  const weighed = recent.filter((point) => point.weight !== null).length;
  if (recent.length < 7 || weighed < 3) return null;
  const origin = recent[0].date;
  const xs = recent.map((point) => daysBetween(origin, point.date));
  const ys = recent.map((point) => point.trend);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  xs.forEach((x, i) => {
    numerator += (x - meanX) * (ys[i] - meanY);
    denominator += (x - meanX) ** 2;
  });
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 7 * 100) / 100;
}

/** Days until `goal` at the current weekly rate, or null if not heading toward it. */
export function daysToGoal(currentTrend: number, goal: number, ratePerWeek: number | null) {
  if (ratePerWeek === null || ratePerWeek === 0) return null;
  const remaining = goal - currentTrend;
  if (Math.sign(remaining) !== Math.sign(ratePerWeek) || Math.abs(remaining) < 0.1) return null;
  return Math.ceil((remaining / ratePerWeek) * 7);
}
