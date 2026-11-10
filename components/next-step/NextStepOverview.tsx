import Link from "next/link";
import type { NextStepCard } from "@/lib/member-view";
import { StepCard } from "./StepCard";
import { stepName } from "@/lib/next-step";

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

// The body of The Next Step page: the Next Steps under way, starting
// another, the ones taken, and the 10s they're heading for. The console's
// preview shows the same, read-only.
export function NextStepOverview({ active, taken, readOnly = false }: { active: NextStepCard[]; taken: NextStepCard[]; readOnly?: boolean }) {
  const heading = [...active, ...taken].filter((c) => c.ten);
  const seenAreas = new Set<string>();
  return (
    <>
      {active.length ? (
        <div className="ns-cards">
          {active.map((c, i) => <StepCard key={c.goal.id} card={c} main={i === 0} several={active.length > 1} readOnly={readOnly} />)}
        </div>
      ) : null}

      <div className="au-sum-card ns-another" inert={readOnly || undefined}>
        <div>
          <p className="ns-strong"><b>{active.length ? "Start a Next Step in another area" : "Start your next Next Step"}</b></p>
          <p className="au-small">
            {active.length >= 2
              ? `You have ${active.length} under way. Most people do best with one or two at a time.`
              : "Choose an area from your chart."}
          </p>
        </div>
        <Link href="/next-step?choose=1" className="btn btn-o">Choose an area</Link>
      </div>

      {taken.length ? (
        <section className="ns-section" aria-labelledby="ns-taken-h">
          <h2 id="ns-taken-h" className="au-detail-k">Taken</h2>
          <ul className="ns-rows">
            {taken.map((c) => (
              <li key={c.goal.id}>
                <span>{stepName(c.goal)} <span className="au-small">· {c.area}</span></span>
                <span>
                  {c.goal.start_score && c.goal.taken_score ? <b>{c.goal.start_score} → {c.goal.taken_score}</b> : null}
                  {c.goal.taken_at ? <span className="au-small"> · taken {short(c.goal.taken_at)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {heading.length ? (
        <section className="ns-section" aria-labelledby="ns-heading-h">
          <h2 id="ns-heading-h" className="au-detail-k">Where you&rsquo;re heading</h2>
          <ul className="ns-rows">
            {heading
              .filter((c) => !seenAreas.has(c.area) && seenAreas.add(c.area))
              .map((c) => (
                <li key={c.goal.id}><span><b className="ns-white">{c.area} at a 10:</b> {c.ten}</span></li>
              ))}
          </ul>
        </section>
      ) : null}

    </>
  );
}
