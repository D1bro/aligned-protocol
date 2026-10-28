import { hasPractice, type Tier } from "./membership.ts";

// Private Daily Alignment. No browser persistence or automatic saving belongs
// here: a member explicitly chooses when a reflection becomes a saved record.
export const ALIGNMENT_SCORES = ["yes", "partly", "not_today", "not_needed"] as const;
export type AlignmentScore = (typeof ALIGNMENT_SCORES)[number];
export type DailyAlignmentInput = {
  entry_date: string;
  timezone: string;
  presence_done?: boolean | null;
  priority?: string | null;
  goal_id?: string | null;
  value?: string | null;
  wellbeing_action?: string | null;
  evening_note?: string | null;
  wellbeing?: AlignmentScore | null;
  meaningful_action?: AlignmentScore | null;
  participation?: AlignmentScore | null;
  values_choice?: AlignmentScore | null;
};
export type WeeklyAlignmentInput = {
  week_start: string;
  timezone: string;
  helped?: string | null;
  adjustment?: string | null;
  next_priority?: string | null;
};
export type AlignmentDaily = Required<DailyAlignmentInput> & {
  id: string; client_id: string; created_at: string; updated_at: string;
};
export type AlignmentWeekly = Required<WeeklyAlignmentInput> & {
  id: string; client_id: string; created_at: string; updated_at: string;
};
export type AlignmentData = {
  available: boolean;
  daily: AlignmentDaily | null;
  days: AlignmentDaily[];
  weekly: AlignmentWeekly | null;
  date: string;
  today: string;
  week_start: string;
  timezone: string;
  goals: { id: string; goal_title: string }[];
};
export type AlignmentResult<T> = { ok: true; entry: T } | { ok: false; field?: string; message: string };
type Validation<T> = { ok: true; values: T } | { ok: false; field: string; message: string };

export function isAlignmentTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100 || (value !== "UTC" && !value.includes("/"))) return false;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: value }); return true; } catch { return false; }
}
export function normalizeTimeZone(value: unknown): string {
  return isAlignmentTimeZone(value) ? value : "UTC";
}
export function localDate(timezone: unknown = "UTC", now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: normalizeTimeZone(timezone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isAlignmentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
// Date-only arithmetic uses UTC noon, never the duration between two local
// midnights. A week is seven calendar dates even across daylight-saving changes.
export function addCalendarDays(date: string, days: number): string {
  if (!isAlignmentDate(date) || !Number.isInteger(days)) throw new Error("Choose a valid calendar date.");
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function weekStart(date: string): string {
  if (!isAlignmentDate(date)) throw new Error("Choose a valid calendar date.");
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addCalendarDays(date, -((day + 6) % 7));
}
export function weekDates(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
}
export function isAlignmentSchemaMissing(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (field: string, message: string) => ({ ok: false as const, field, message });
function optionalText(value: unknown, limit: number, field: string): Validation<string | null> {
  if (value === null || value === undefined) return { ok: true, values: null };
  if (typeof value !== "string") return fail(field, "Use text for this field.");
  const text = value.replace(/\r\n?/g, "\n").trim();
  if ([...text].length > limit) return fail(field, `Use up to ${limit} characters.`);
  return { ok: true, values: text || null };
}
function validDateAndZone(raw: Record<string, unknown>, dateField: string): Validation<{ date: string; timezone: string }> {
  if (!isAlignmentDate(raw[dateField])) return fail(dateField, "Choose a valid calendar date.");
  // An absent zone uses UTC. An explicitly invalid value is surfaced, so it
  // cannot quietly move a member's record into an unexpected local day.
  const zone = raw.timezone === null || raw.timezone === undefined || raw.timezone === "" ? "UTC" : raw.timezone;
  if (!isAlignmentTimeZone(zone)) return fail("timezone", "Choose a valid IANA time zone, such as Europe/London.");
  return { ok: true, values: { date: raw[dateField] as string, timezone: zone } };
}
export function checkDailyAlignment(raw: Partial<Record<keyof DailyAlignmentInput, unknown>>): Validation<Required<DailyAlignmentInput>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("entry_date", "Choose a valid daily entry.");
  const base = validDateAndZone(raw, "entry_date");
  if (!base.ok) return base;
  const presence = raw.presence_done ?? null;
  if (presence !== null && typeof presence !== "boolean") return fail("presence_done", "Choose yes, no, or leave this unanswered.");
  const goal = raw.goal_id === "" || raw.goal_id === undefined ? null : raw.goal_id;
  if (goal !== null && (typeof goal !== "string" || !uuid.test(goal))) return fail("goal_id", "Choose one of your goals, or leave this blank.");
  const texts: Record<string, string | null> = {};
  for (const [field, limit] of Object.entries({ priority: 500, value: 80, wellbeing_action: 300, evening_note: 1000 })) {
    const checked = optionalText(raw[field as keyof DailyAlignmentInput], limit, field);
    if (!checked.ok) return checked;
    texts[field] = checked.values;
  }
  const scores: Record<string, AlignmentScore | null> = {};
  for (const field of ["wellbeing", "meaningful_action", "participation", "values_choice"] as const) {
    const score = raw[field] ?? null;
    if (score !== null && (!(ALIGNMENT_SCORES as readonly unknown[]).includes(score) || (score === "not_needed" && field !== "values_choice"))) {
      return fail(field, "Choose an available response, or leave this unanswered.");
    }
    scores[field] = score as AlignmentScore | null;
  }
  return { ok: true, values: {
    entry_date: base.values.date, timezone: base.values.timezone, presence_done: presence,
    goal_id: goal as string | null, priority: texts.priority, value: texts.value,
    wellbeing_action: texts.wellbeing_action, evening_note: texts.evening_note,
    wellbeing: scores.wellbeing, meaningful_action: scores.meaningful_action,
    participation: scores.participation, values_choice: scores.values_choice,
  } };
}
export function checkWeeklyAlignment(raw: Partial<Record<keyof WeeklyAlignmentInput, unknown>>): Validation<Required<WeeklyAlignmentInput>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("week_start", "Choose a valid weekly review.");
  const base = validDateAndZone(raw, "week_start");
  if (!base.ok) return base;
  if (weekStart(base.values.date) !== base.values.date) return fail("week_start", "Choose the Monday at the start of this week.");
  const texts: Record<string, string | null> = {};
  for (const field of ["helped", "adjustment", "next_priority"] as const) {
    const checked = optionalText(raw[field], 1000, field);
    if (!checked.ok) return checked;
    texts[field] = checked.values;
  }
  return { ok: true, values: { week_start: base.values.date, timezone: base.values.timezone,
    helped: texts.helped, adjustment: texts.adjustment, next_priority: texts.next_priority } };
}

// The weekly account for one question, as plain counts. No overall score:
// blank answers, days with nothing saved and days still to come are kept
// apart, and "No challenge arose" is never part of the answered total.
export type ScoreField = "wellbeing" | "meaningful_action" | "participation" | "values_choice";
export const SCORE_FIELDS: ScoreField[] = ["wellbeing", "meaningful_action", "participation", "values_choice"];
export type WeekCounts = {
  yes: number;
  partly: number;
  not_today: number;
  not_needed: number; // only ever counted for values_choice
  answered: number; // yes + partly + not_today
  blank: number; // saved entries with this question left blank
  unrecorded: number; // today or earlier, with no saved entry
  upcoming: number; // later this week; never "missed"
};
export function summariseWeek(
  days: { entry_date: string; wellbeing?: AlignmentScore | null; meaningful_action?: AlignmentScore | null; participation?: AlignmentScore | null; values_choice?: AlignmentScore | null }[],
  anyDateInWeek: string,
  today: string
): Record<ScoreField, WeekCounts> {
  const byDate = new Map(days.map((d) => [d.entry_date, d]));
  const result = {} as Record<ScoreField, WeekCounts>;
  for (const field of SCORE_FIELDS) {
    const c: WeekCounts = { yes: 0, partly: 0, not_today: 0, not_needed: 0, answered: 0, blank: 0, unrecorded: 0, upcoming: 0 };
    for (const date of weekDates(anyDateInWeek)) {
      if (date > today) { c.upcoming++; continue; }
      const entry = byDate.get(date);
      if (!entry) { c.unrecorded++; continue; }
      const v = entry[field] ?? null;
      if (v === null) c.blank++;
      else if (v === "not_needed") c.not_needed++;
      else { c[v]++; c.answered++; }
    }
    result[field] = c;
  }
  return result;
}

// Plain words for one question's counts, e.g. "Yes 2 · Partly 1 · Not today 1".
export function describeCounts(c: WeekCounts): { answers: string; days: string } {
  const answers = c.answered ? `Yes ${c.yes} · Partly ${c.partly} · Not today ${c.not_today}` : "No answers saved";
  const parts = [
    `${c.answered} answered ${c.answered === 1 ? "day" : "days"}`,
    c.blank ? `${c.blank} saved but left blank` : "",
    c.unrecorded ? `${c.unrecorded} unrecorded ${c.unrecorded === 1 ? "day" : "days"}` : "",
    c.upcoming ? `${c.upcoming} still to come` : "",
  ].filter(Boolean);
  return { answers, days: parts.join(" · ") };
}

// The day's three wins: arriving (the morning audio or a moment's pause),
// setting an intention (any of the three morning answers), and reflecting
// (any evening answer or note). Each is a win however small; none is scored.
export type AlignmentWins = { arrive: boolean; intention: boolean; reflect: boolean; count: number };
type WinFields = Partial<Pick<DailyAlignmentInput, "presence_done" | "priority" | "value" | "wellbeing_action" | "evening_note" | ScoreField>>;
const filled = (v: string | null | undefined) => !!v && v.trim() !== "";
export function alignmentWins(day: WinFields | null | undefined): AlignmentWins {
  const arrive = day?.presence_done === true;
  const intention = !!day && (filled(day.priority) || filled(day.value) || filled(day.wellbeing_action));
  const reflect = !!day && (filled(day.evening_note) || SCORE_FIELDS.some((f) => day[f] != null));
  return { arrive, intention, reflect, count: Number(arrive) + Number(intention) + Number(reflect) };
}

// Saving is for today and earlier only: a reflection on a day that hasn't
// happened yet isn't one. Weeks likewise stop at the current week.
export function isFutureDay(date: string, timezone: string, now = new Date()): boolean {
  return date > localDate(timezone, now);
}
export function isFutureWeek(mondayDate: string, timezone: string, now = new Date()): boolean {
  return mondayDate > weekStart(localDate(timezone, now));
}

export const ALIGNMENT_EXPORT_SCHEMA = { name: "aligned.daily-alignment", version: 1 } as const;

// Who can use Daily Alignment and the journal: Aligned Practice and Momentum
// members (lib/membership.ts), and staff, practising on their own private
// records. After a membership ends their entries stay theirs to export.
export function canUseDailyAlignment(role: string | null | undefined, tier: Tier = "clarity"): boolean {
  return hasPractice(tier, role);
}
