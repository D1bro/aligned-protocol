import { ClientContextEditor } from "@/components/coach/ClientContextEditor";

export type SnapshotArea = { name: string; now: number | null; before: number | null; agreed: number | null; note: string | null; focus: boolean };
export type SnapshotProps = {
  clientId: string;
  firstName: string;
  glance: { preferredName: string | null; localTime: string | null; status: string | null; since: string; held: number; nextBooking: string | null };
  context: { available: boolean; notes: string };
  map: { auditDate: string | null; wholeLife: number | null; calibratedOn: string | null; areas: SnapshotArea[] } | null;
  plan: { goal: string; why: string | null; area: string | null; now: number | null; target: number | null; focusThisWeek: string | null; intention: string | null } | null;
  otherGoals: string[];
};

// Then → now, with an arrow only for a change of 2 or more (a 1-point move
// is often just a different day).
function Move({ before, now }: { before: number | null; now: number | null }) {
  if (before === null || now === null) return null;
  const d = now - before;
  if (Math.abs(d) < 2) return <span className="snap-move">{before} → {now}</span>;
  return <span className={`snap-move ${d > 0 ? "is-up" : "is-down"}`}>{before} → {now} {d > 0 ? `↑${d}` : `↓${-d}`}</span>;
}

// Where the client is, beside the conversation: the basics at a glance, what
// the coach knows about them, their chart, and their plan right now. Folds
// away so it never gets in the way. Their journal, daily practice, month
// reflections and date of birth are private to them and never shown here.
export function ClientSnapshot({ clientId, firstName, glance, context, map, plan, otherGoals }: SnapshotProps) {
  return (
    <section className="admin-card snap" aria-labelledby="snap-h">
      <div className="snap-top">
        <h2 id="snap-h">{firstName} at a glance</h2>
        <a href={`/coach/clients/${clientId}?tab=goals`} target="_blank" rel="noopener noreferrer" className="au-text-link">Full profile ↗</a>
      </div>
      <dl className="snap-facts">
        {glance.preferredName ? <div><dt>Goes by</dt><dd>{glance.preferredName}</dd></div> : null}
        {glance.localTime ? <div><dt>Their time</dt><dd>{glance.localTime}</dd></div> : null}
        <div><dt>Client since</dt><dd>{glance.since}{glance.status && glance.status !== "active" ? ` · ${glance.status === "paused" ? "Paused" : "Former client"}` : ""}</dd></div>
        <div><dt>Sessions held</dt><dd>{glance.held}</dd></div>
        {glance.nextBooking ? <div><dt>Next booked</dt><dd>{glance.nextBooking}</dd></div> : null}
      </dl>

      {map ? (
        <details className="snap-part" open>
          <summary>Their chart{map.auditDate ? ` · ${map.auditDate}` : ""}{map.wholeLife !== null ? ` · ${map.wholeLife}/100` : ""}</summary>
          {map.calibratedOn ? <p className="snap-sub">Agreed scores from your calibration on {map.calibratedOn}.</p> : null}
          <ul className="snap-areas">
            {map.areas.map((a) => (
              <li key={a.name} className={a.focus ? "is-focus" : undefined} title={a.note ?? undefined}>
                <span className="snap-name">{a.name}{a.focus ? <span className="snap-focus"> · focus</span> : null}</span>
                <span className="snap-score">
                  <Move before={a.before} now={a.now} />
                  {a.before === null && a.now !== null ? <span className="snap-move">{a.now}</span> : null}
                  {a.agreed !== null ? <span className="snap-agreed">agreed {a.agreed}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="snap-sub">Then → now from their last two audits. Hover an area for their note.</p>
        </details>
      ) : (
        <p className="snap-sub">No audit yet.</p>
      )}

      {plan ? (
        <details className="snap-part" open>
          <summary>Their plan right now</summary>
          <p className="snap-goal">{plan.goal}</p>
          {plan.area ? <p className="snap-sub">{plan.area}{plan.now !== null ? `: ${plan.now}/10` : ""}{plan.target !== null ? ` · aiming for ${plan.target}` : ""}</p> : null}
          {plan.why ? <p className="snap-sub">Why it matters: &ldquo;{plan.why}&rdquo;</p> : null}
          {plan.focusThisWeek ? <p className="snap-sub"><b>This week:</b> {plan.focusThisWeek}</p> : null}
          {plan.intention ? <p className="snap-sub"><b>This month:</b> {plan.intention}</p> : null}
          {otherGoals.length ? <p className="snap-sub"><b>Also active:</b> {otherGoals.join(" · ")}</p> : null}
        </details>
      ) : null}

      {context.available ? (
        <details className="snap-part">
          <summary>What you know about {firstName}</summary>
          <ClientContextEditor key={context.notes} clientId={clientId} firstName={firstName} initial={context.notes} />
        </details>
      ) : null}
    </section>
  );
}
