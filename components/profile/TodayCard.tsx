import Link from "next/link";
import { getTodayAlignment } from "@/lib/actions/alignment";
import { firstActionDate, longDay, plannedDays } from "@/lib/review-schedule";
import type { PlanAction } from "@/lib/planning";
import { Icon } from "@/components/ui/Icon";
import { Mark, WINS } from "@/components/profile/DailyAlignmentCard";
import { TodayActions } from "@/components/profile/TodayActions";
import type { TodayAction, TodayMove } from "@/lib/daily-log";

// Today on My Space: today's actions, from their plan (never a separate
// to-do list) plus any they add, linked to a goal where it fits; any steps
// agreed with their coach; and, for Practice and Momentum members, today's
// three wins from the daily practice.
export async function TodayCard({
  action,
  actionWhen,
  moveId = null,
  movesDone = null,
  fallback,
  coachSteps,
  practice,
  goalId,
  goals,
  week,
  log = null,
}: {
  action: string;
  actionWhen: string | null;
  // Their next move when it's a one-off: ticking it here ticks the move.
  moveId?: string | null;
  // Every move of their Next Step is done: what next.
  movesDone?: { addHref: string; takenHref: string } | null;
  fallback: string | null;
  coachSteps: { id: string; body: string }[];
  practice: boolean;
  goalId: string | null;
  goals: { id: string; title: string }[];
  week: { available: boolean; today: string; actions: PlanAction[] };
  // The daily log (migration 0032): every move due today and the session
  // actions linked or due. When it's there, it replaces the single action.
  log?: { available: boolean; moves: (TodayMove & { step: string })[]; actions: TodayAction[]; total: number } | null;
}) {
  const daily = !!log?.available && (log.total > 0 || log.actions.length > 0);
  const todays = week.actions.filter((a) => a.action_date === week.today);
  const planTick = todays.find((a) => a.source === "plan" && a.goal_id === goalId && a.body === action) ?? null;
  const nextDay = action ? firstActionDate(`${week.today}T12:00:00Z`, actionWhen) : null;
  // With no set days (a focus from their weekly review), it can be done any day.
  const plannedToday = nextDay === week.today || !plannedDays(actionWhen).length;
  const plan = daily ? null : action && goalId
    ? moveId
      ? { goalId, body: action, done: false, moveId }
      : plannedToday || planTick ? { goalId, body: action, done: !!planTick?.done_at } : null
    : null;
  const today = practice ? await getTodayAlignment().catch(() => null) : null;
  const wins = today?.wins ?? { arrive: false, intention: false, reflect: false, count: 0 };

  return (
    <section className="pf-tile ms-tile ms-today" aria-labelledby="ms-today-h">
      <div className="ms-head">
        <Icon name="sunrise" size={18} />
        <h2 id="ms-today-h">Today</h2>
      </div>
      {week.available ? (
        <TodayActions
          plan={plan}
          moves={daily ? log!.moves : []}
          sessionActions={daily ? log!.actions : []}
          own={todays.filter((a) => a.source === "own")}
          goals={goals}
          defaultGoalId={goalId}
        />
      ) : null}
      {movesDone ? (
        <p className="pf-sub">
          All your moves for this Next Step are done. <Link href={movesDone.addHref} className="au-text-link">Add my next move</Link>
          {" "}or, if it&rsquo;s happened, <Link href={movesDone.takenHref} className="au-text-link">it&rsquo;s taken</Link>.
        </p>
      ) : null}
      {daily && !log!.moves.length && !movesDone ? <p className="pf-sub">Nothing from your Next Step today.</p> : null}
      {!daily && action && !plan ? (
        <p className="pf-sub">
          Nothing from your Next Step today{nextDay ? `; next: ${longDay(nextDay).split(" ")[0]}` : ""}.
          {!week.available ? <> Your action: {action}</> : null}
        </p>
      ) : null}
      {plan && fallback ? <ul className="pf-tags"><li>Hard day: {fallback.charAt(0).toLowerCase() + fallback.slice(1)}</li></ul> : null}
      {!daily && coachSteps.length ? (
        <div className="next-action-coaching">
          <p className="au-detail-k">Agreed with your coach</p>
          <ul>{coachSteps.map((c) => <li key={c.id}>{c.body}</li>)}</ul>
        </div>
      ) : null}
      {practice ? (
        <div className="ms-today-practice">
          <p className="profile-card-k">Daily practice · {wins.count} of 3 today</p>
          <ul className="dp-pills">
            {WINS.map((w) => (
              <li key={w.key} className={wins[w.key] ? "is-done" : undefined}>
                <Mark done={wins[w.key]} />{w.label}<span className="sr-only">{wins[w.key] ? ": done" : ": not yet"}</span>
              </li>
            ))}
          </ul>
          <Link href="/alignment" className="btn btn-p">{today?.saved ? "Continue today →" : "Open today →"}</Link>
        </div>
      ) : null}
    </section>
  );
}
