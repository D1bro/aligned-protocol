// 1,000 Months (brief, 3 Nov 2026): an optional way to see a life as months.
// Months are "YYYY-MM". Only the month and year of birth are used, and nothing
// here produces an age, a count of months remaining or an end date: future
// months are possibility, not a countdown. Pure, so it can be tested.

// The six month colours. The member chooses; the app never assigns one.
export const MONTH_COLOURS = [
  { key: "inspired", label: "Inspired" },
  { key: "aligned", label: "Aligned" },
  { key: "growing", label: "Growing" },
  { key: "restoring", label: "Restoring" },
  { key: "navigating", label: "Navigating" },
  { key: "drifting", label: "Drifting" },
] as const;
export type MonthColour = (typeof MONTH_COLOURS)[number]["key"];
export const isMonthColour = (v: unknown): v is MonthColour => MONTH_COLOURS.some((c) => c.key === v);
export const colourLabel = (key: string | null | undefined) => MONTH_COLOURS.find((c) => c.key === key)?.label ?? null;

export type MonthState = "before" | "past" | "current" | "future";
export type MonthCell = { ym: string; state: MonthState };

const LIFE_MONTHS = 1000;

// My Journey is out of the menu and My Space for now (Duane, 10 Nov 2026: it
// didn't add enough and complicated the flow). Its page stays at /journey so
// it can come back: set this to true to show it again. 1,000 Months has its
// own place under More.
export const MY_JOURNEY_SHOWN = false;
const isYm = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const index = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const ymAt = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

export const ymOf = (ymd: string) => ymd.slice(0, 7);
export const monthDate = (ym: string) => `${ym}-01`;
export function parseYm(v: string | null | undefined): string | null {
  return v && isYm(v) ? v : null;
}
export function addMonths(ym: string, n: number): string {
  return ymAt(index(ym) + n);
}
export function monthName(ym: string, style: "long" | "short" = "long"): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: style, year: "numeric", timeZone: "UTC" });
}

const stateOf = (i: number, today: number): MonthState => (i < today ? "past" : i === today ? "current" : "future");

// The whole grid: a row per calendar year, from the year of birth, holding
// the 1,000 months from the month of birth ("before" pads the first row).
export function lifeGrid(birthYm: string, todayYm: string): { year: number; months: MonthCell[] }[] {
  const start = index(birthYm);
  const today = index(todayYm);
  const rows: { year: number; months: MonthCell[] }[] = [];
  for (let year = Math.floor(start / 12); year * 12 < start + LIFE_MONTHS; year++) {
    const months: MonthCell[] = [];
    for (let m = 0; m < 12; m++) {
      const i = year * 12 + m;
      if (i < start || i >= start + LIFE_MONTHS) months.push({ ym: ymAt(i), state: "before" });
      else months.push({ ym: ymAt(i), state: stateOf(i, today) });
    }
    rows.push({ year, months });
  }
  return rows;
}

// One calendar year, for "your current chapter" and the phone's year view.
// Without a date of birth every month of the year counts.
export function yearRow(year: number, todayYm: string, birthYm: string | null = null): MonthCell[] {
  const today = index(todayYm);
  const start = birthYm ? index(birthYm) : -Infinity;
  return Array.from({ length: 12 }, (_, m) => {
    const i = year * 12 + m;
    return { ym: ymAt(i), state: i < start ? "before" : stateOf(i, today) };
  });
}

// A date of birth as typed (YYYY-MM-DD): a real date, not in the future,
// from 1900. Blank clears it.
export function checkBirthDate(value: string, todayYmd: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const v = value.trim();
  if (!v) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, message: "Use the date picker, or write it as YYYY-MM-DD." };
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false, message: "That date doesn’t exist." };
  if (v < "1900-01-01" || v > todayYmd) return { ok: false, message: "That date doesn’t look right." };
  return { ok: true, value: v };
}
