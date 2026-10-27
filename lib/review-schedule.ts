import { BUSINESS_TZ, localDate } from "./time.ts";

// The weekly rhythm of a plan: a short weekly review the day after the
// week's last planned action, and every fourth review is the monthly review
// (where the area is scored again). Worked out from the goal's action_when
// ("Every Sunday at 6pm, after dinner") and the reviews already done;
// nothing is stored. Calendar days are in the business time zone.

export type ReviewKind = "weekly" | "monthly";
export type NextReview = {
  date: string; // YYYY-MM-DD
  kind: ReviewKind;
  number: number; // 1 for their first review
  due: boolean;
  daysAway: number; // 0 today, negative when overdue
};

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const ymdOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
// 0 = Monday … 6 = Sunday
const weekdayOf = (n: number) => (new Date(n * 86_400_000).getUTCDay() + 6) % 7;

// Which weekdays the action is planned for, 0 = Monday.
export function plannedDays(actionWhen: string | null | undefined): number[] {
  const w = (actionWhen ?? "").toLowerCase();
  if (/\bevery day\b|\bdaily\b/.test(w)) return [0, 1, 2, 3, 4, 5, 6];
  return DAY_NAMES.map((d, i) => (w.includes(d) ? i : -1)).filter((i) => i !== -1);
}

// The day after the week's last planned action (Monday for a Sunday or daily
// action). With no days chosen, a week after the start.
function reviewWeekday(days: number[]): number | null {
  return days.length ? (Math.max(...days) + 1) % 7 : null;
}

function nextReviewDay(fromDay: number, days: number[], afterReview: boolean): number {
  const weekday = reviewWeekday(days);
  if (weekday === null) return fromDay + 7;
  let d = fromDay + 1;
  while (weekdayOf(d) !== weekday) d++;
  // A review done early shouldn't bring the next one round in a few days.
  if (afterReview && d - fromDay < 4) d += 7;
  return d;
}

export function nextReview(
  input: { start: string; actionWhen: string | null | undefined; reviews: { created_at: string }[] },
  now: Date = new Date(),
  timeZone = BUSINESS_TZ
): NextReview {
  const days = plannedDays(input.actionWhen);
  const latest = input.reviews.map((r) => r.created_at).sort().at(-1);
  const from = dayNumber(localDate(latest ?? input.start, timeZone));
  const day = nextReviewDay(from, days, !!latest);
  const number = input.reviews.length + 1;
  const today = dayNumber(localDate(now, timeZone));
  return { date: ymdOf(day), kind: number % 4 === 0 ? "monthly" : "weekly", number, due: today >= day, daysAway: day - today };
}

// The next few review dates if each is done on its day, for "what happens
// next" on Your plan is set.
export function upcomingReviews(start: string, actionWhen: string | null | undefined, count = 4, timeZone = BUSINESS_TZ) {
  const days = plannedDays(actionWhen);
  const out: { date: string; kind: ReviewKind }[] = [];
  let from = dayNumber(localDate(start, timeZone));
  for (let i = 1; i <= count; i++) {
    from = nextReviewDay(from, days, i > 1);
    out.push({ date: ymdOf(from), kind: i % 4 === 0 ? "monthly" : "weekly" });
  }
  return out;
}

// The first day they'll do the action, from the start date (that day counts).
export function firstActionDate(start: string, actionWhen: string | null | undefined, timeZone = BUSINESS_TZ): string | null {
  const days = plannedDays(actionWhen);
  if (!days.length) return null;
  let d = dayNumber(localDate(start, timeZone));
  while (!days.includes(weekdayOf(d))) d++;
  return ymdOf(d);
}

// "Monday 2 November"
export function longDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).replace(",", "");
}
