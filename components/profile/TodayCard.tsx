import Link from "next/link";
import { getTodayAlignment } from "@/lib/actions/alignment";
import { firstActionDate, longDay } from "@/lib/review-schedule";
import { localDate } from "@/lib/time";
import { Icon } from "@/components/ui/Icon";
import { Mark, WINS } from "@/components/profile/DailyAlignmentCard";

// Today on My Space. The action comes from their plan (never a separate to-do
// list), with any steps agreed with their coach; Practice and Momentum members
// also see today's three wins from the daily practice.
export async function TodayCard({
  action,
  actionWhen,
  fallback,
  coachSteps,
  practice,
}: {
  action: string;
  actionWhen: string | null;
  fallback: string | null;
  coachSteps: { id: string; body: string }[];
  practice: boolean;
}) {
  const now = new Date();
  const nextDay = action ? firstActionDate(now.toISOString(), actionWhen) : null;
  const isToday = nextDay === localDate(now);
  const today = practice ? await getTodayAlignment().catch(() => null) : null;
  const wins = today?.wins ?? { arrive: false, intention: false, reflect: false, count: 0 };

  return (
    <section className="pf-tile ms-card ms-today" aria-labelledby="ms-today-h">
      <div className="ms-head">
        <Icon name="sunrise" size={18} />
        <h2 id="ms-today-h">Today</h2>
      </div>
      {action ? (
        <div className="ms-today-action">
          <p className="profile-card-k">Your action</p>
          <p className="pf-commit">{action}</p>
          {isToday || nextDay || fallback ? (
            <ul className="pf-tags">
              {isToday ? <li className="is-gold">Planned for today</li> : nextDay ? <li>Next: {longDay(nextDay).split(" ")[0]}</li> : null}
              {fallback ? <li>Hard day: {fallback.charAt(0).toLowerCase() + fallback.slice(1)}</li> : null}
            </ul>
          ) : null}
          {coachSteps.length ? (
            <div className="next-action-coaching">
              <p className="au-detail-k">Agreed with your coach</p>
              <ul>{coachSteps.map((c) => <li key={c.id}>{c.body}</li>)}</ul>
            </div>
          ) : null}
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
      ) : (
        <Link href="/plan" className="au-text-link">See my plan →</Link>
      )}
    </section>
  );
}
