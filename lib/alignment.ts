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
