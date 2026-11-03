// Connected planning (brief, 3 Nov 2026): My Plan → Monthly Intention →
// Weekly Focus → Today's Actions. Pure helpers; the reads and writes are in
// lib/actions/planning.ts. Dates are YYYY-MM-DD calendar days.

export type PlanAction = {
  id: string;
  goal_id: string | null;
  action_date: string;
  source: "plan" | "own";
  body: string;
  done_at: string | null;
};
export type MonthlyIntention = { id: string; month: string; intention: string; goal_id: string | null };

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const ymdOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

// The first day of the month a date falls in.
export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

// The Monday of the week a date falls in.
export function weekStartOf(ymd: string): string {
  const n = dayNumber(ymd);
  return ymdOf(n - ((new Date(n * 86_400_000).getUTCDay() + 6) % 7));
}

// The week's progress, counted, never estimated: each day the plan's action
// is planned (or was ticked anyway) is one action, and so is each action they
// added. `plannedWeekdays` is 0 = Monday … 6 = Sunday.
export function weekProgress(weekStart: string, plannedWeekdays: number[], actions: Pick<PlanAction, "action_date" | "source" | "done_at">[]) {
  const start = dayNumber(weekStart);
  const inWeek = actions.filter((a) => {
    const n = dayNumber(a.action_date);
    return n >= start && n < start + 7;
  });
  const planDays = new Set(plannedWeekdays.map((d) => ymdOf(start + d)));
  for (const a of inWeek) if (a.source === "plan") planDays.add(a.action_date);
  const own = inWeek.filter((a) => a.source === "own");
  const done = inWeek.filter((a) => a.done_at).length;
  return { done, total: planDays.size + own.length };
}

// Starting points for "How do you want to live this month?", from the goals
// they've accepted. Only ever suggestions: they edit or replace them.
export function intentionSuggestions(goals: { area: string | null; title: string | null }[]): string[] {
  const out: string[] = [];
  for (const g of goals) {
    if (g.area) out.push(`Steady progress with ${g.area.toLowerCase()}, one week at a time`);
    if (g.title?.trim()) out.push(`Keep my promise: ${g.title.trim().replace(/[.!]+$/, "")}`);
  }
  out.push("Present, patient and kind to myself");
  return [...new Set(out)].slice(0, 4);
}

// An empty href means accepting it is simply keeping things as they are.
export type AuditSuggestion = { key: string; text: string; href: string; label: string };

// After a new audit: what's changed since the goal was set, as suggestions
// they can accept, edit or dismiss. Nothing here changes a goal; each link
// opens the plan for them to decide. Scores are their own, 1–10.
export function auditSuggestions(input: {
  area: { id: string; name: string };
  target: number;
  areas: { id: string; name: string }[];
  before: Map<string, number>;
  after: Map<string, number>;
}): AuditSuggestion[] {
  const { area, target, areas, before, after } = input;
  const out: AuditSuggestion[] = [];
  const was = before.get(area.id);
  const now = after.get(area.id);
  if (was !== undefined && now !== undefined) {
    if (now >= target) {
      out.push({ key: "reached", text: `${area.name} is now ${now}/10: you’ve reached your aim of ${target}. Set your next step, or mark this goal done.`, href: "/plan?edit=1", label: "Set my next step" });
    } else if (now < was) {
      out.push({ key: "dropped", text: `${area.name} has gone from ${was} to ${now}. A smaller action for a while is not a step back.`, href: "/plan?edit=4", label: "Adjust my action" });
    } else {
      out.push({ key: "keep", text: `${area.name} is ${now}/10 (it was ${was}), working towards ${target}. Your plan still fits: keep going.`, href: "", label: "Keep my plan" });
    }
  }
  // Elsewhere: the area that dropped the most, if it dropped by 2 or more.
  const drops = areas
    .filter((a) => a.id !== area.id && before.has(a.id) && after.has(a.id))
    .map((a) => ({ a, d: after.get(a.id)! - before.get(a.id)! }))
    .filter((x) => x.d <= -2)
    .sort((x, y) => x.d - y.d);
  if (drops[0]) {
    const { a } = drops[0];
    out.push({ key: "elsewhere", text: `${a.name} has gone from ${before.get(a.id)} to ${after.get(a.id)}. You could make it your next focus; your current goal stays as it is.`, href: "/plan?latest=1", label: `Plan for ${a.name}` });
  }
  return out;
}
