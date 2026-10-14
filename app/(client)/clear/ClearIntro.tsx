import Link from "next/link";
import type { LifeArea } from "@/lib/actions/audit";
import type { ClearPlan } from "@/lib/actions/clear";
import { formatDate } from "@/lib/audit-schedule";
import { ScoreTrack } from "@/components/audit/ScoreTrack";

export const CLEAR_STEPS = [
  { letter: "C", name: "Current reality", line: "Where things honestly are, starting from your audit." },
  { letter: "L", name: "Life vision", line: "Where you’re heading, and your next step up." },
  { letter: "E", name: "Emotional blocks", line: "What’s been in the way, and why." },
  { letter: "A", name: "Aligned goal", line: "One action: what, when, and how often." },
  { letter: "R", name: "Roadmap and review", line: "How you’ll know, and what you’ll do if it gets hard." },
];

// Shown before step 1: what CLEAR is, how it uses the snapshot, and the area
// they chose — echoed back before they begin, with the option to change it.
export function ClearIntro({
  area,
  score,
  plan,
  nextAuditDue,
}: {
  area: LifeArea;
  score: number;
  plan: ClearPlan;
  nextAuditDue: Date;
}) {
  const target = Math.min(10, score + 1);
  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> CLEAR — your plan</div>
      <h1 className="au-latest-h">Turn your snapshot into one clear step.</h1>
      <p className="lead">
        CLEAR is a short guided plan — five questions, about ten minutes. It takes the area you chose from your
        snapshot and turns it into one goal you can act on this week.
      </p>

      <div className="clear-intro">
        <section className="clear-start" aria-label="Your starting point">
          <div className="eyebrow"><span className="eydot" /> Your starting point</div>
          <h2>{area.name}</h2>
          <ScoreTrack score={score} target={target} />
          {plan.step_up_answer ? (
            <blockquote className="au-quote">
              <cite>You said a {plan.step_up_target ?? target} would look like</cite>
              <p>&ldquo;{plan.step_up_answer}&rdquo;</p>
            </blockquote>
          ) : (
            <p className="au-start-help">
              As you go, keep one question in mind: what would a {target} look like in this area?
            </p>
          )}
          <Link href="/clear?choose=1" className="au-text-link">Choose a different area</Link>
        </section>

        <ol className="clear-letters">
          {CLEAR_STEPS.map((s) => (
            <li key={s.letter}>
              <span className="clear-letter">{s.letter}</span>
              <div>
                <h3>{s.name}</h3>
                <p>{s.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="clear-after">
        When you finish, your plan lives in My plan, with a goal check-in each month. Your suggested next
        whole-life audit is around {formatDate(nextAuditDue)}; your goal can finish sooner or carry on after it.
      </p>
      <div className="au-latest-actions">
        <Link href="/clear?start=1" className="btn btn-p">Begin CLEAR →</Link>
        <span className="au-small">Your answers save as you go — you can stop and come back.</span>
      </div>
    </div>
  );
}
