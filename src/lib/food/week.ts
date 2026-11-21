// =============================================================================
// WEEK HELPERS — dates as "YYYY-MM-DD" strings
// =============================================================================
// Weeks start on SUNDAY (Israeli week). Postgres `date` columns come back from
// Drizzle as "YYYY-MM-DD" strings, so we keep dates in that format everywhere
// and only turn them into Date objects to do arithmetic.
// We use UTC for the arithmetic so a timezone can never shift a day.
// =============================================================================

export type ISODate = string; // "2026-11-22"

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

function parse(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Today in the user's local timezone, as YYYY-MM-DD. */
export function today(): ISODate {
  const now = new Date();
  return toISODate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** The Sunday that starts the week containing `date`. */
export function weekStartOf(date: ISODate = today()): ISODate {
  return addDays(date, -parse(date).getUTCDay());
}

/** The 7 dates of the week that starts on `weekStart`. */
export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** "Sun", "Mon", … */
export function dayName(date: ISODate, style: "short" | "long" = "short"): string {
  return parse(date).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
}

/** "22 Nov" */
export function shortDate(date: ISODate): string {
  return parse(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "22–28 Nov" (or "29 Nov – 5 Dec" across months) */
export function weekLabel(weekStart: ISODate): string {
  const end = addDays(weekStart, 6);
  const [startDay, startMonth] = shortDate(weekStart).split(" ");
  const [endDay, endMonth] = shortDate(end).split(" ");
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}
