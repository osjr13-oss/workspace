/**
 * Selrano runs on the owner's clock (owner decision 2026-11-19): every date and
 * time the model sees is Eastern Time, never UTC. America/New_York follows
 * daylight saving, so it is EST in winter and EDT in summer.
 */
export const OWNER_TIME_ZONE = "America/New_York";

function parts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: OWNER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function iso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** Today's date in Eastern Time, as YYYY-MM-DD. */
export function ownerToday(date = new Date()) {
  const { year, month, day } = parts(date);
  return iso(year, month, day);
}

/** The Eastern date `days` days before today, as YYYY-MM-DD. */
export function ownerDaysAgo(days: number, date = new Date()) {
  const { year, month, day } = parts(date);
  return iso(year, month, day - days);
}

/** The first day of this Eastern month (offset -1 for last month), as YYYY-MM-DD. */
export function ownerMonthStart(offset = 0, date = new Date()) {
  const { year, month } = parts(date);
  return iso(year, month + offset, 1);
}

/** For prompts: "Thursday, November 19, 2026, 10:42 PM Eastern Time". */
export function ownerNow(date = new Date()) {
  const text = date.toLocaleString("en-US", {
    timeZone: OWNER_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  return `${text} Eastern Time`;
}
