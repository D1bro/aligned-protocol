import Link from "next/link";
import { getRecentCompletedAudits, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getAllGoals, getAllCheckIns } from "@/lib/actions/checkins";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { formatDate, nextAuditDue } from "@/lib/audit-schedule";
import { LifeMap } from "@/components/audit/LifeMap";

type Event = { date: string; kind: "audit" | "goal" | "done" | "checkin"; title: string; detail?: string };

// My journey: how their life map has changed between audits, how each area
// moved, and everything they've done along the way.
export default async function JourneyPage() {
  const [audits, areas, goals, checkIns] = await Promise.all([
    getRecentCompletedAudits(50),
    getLifeAreas(),
    getAllGoals(),
    getAllCheckIns(),
  ]);

  if (!audits.length) {
    return (
      <div className="page au-page">
        <div className="eyebrow"><span className="eydot" /> My journey</div>
        <h1 className="au-latest-h">Your journey starts with the audit.</h1>
        <p className="lead">Once you&rsquo;ve taken it, this page shows how your life map changes over time.</p>
        <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
      </div>
    );
  }

  const latest = audits[0];
  const previous = audits[1] ?? null;
  const first = audits[audits.length - 1];
  const [{ responses: nowR }, prevData] = await Promise.all([
    getAuditWithResponses(latest.id),
    previous ? getAuditWithResponses(previous.id) : Promise.resolve(null),
  ]);
  const scoreIn = (rs: { life_area_id: string; satisfaction_score: number }[]) => {
    const m = new Map(rs.map((r) => [r.life_area_id, r.satisfaction_score]));
    return areas.map((a) => m.get(a.id) ?? 0);
  };
  const now = scoreIn(nowR as { life_area_id: string; satisfaction_score: number }[]);
  const before = prevData ? scoreIn(prevData.responses as { life_area_id: string; satisfaction_score: number }[]) : null;
  const changes = before ? areas.map((a, i) => ({ name: a.name, before: before[i], now: now[i], delta: now[i] - before[i] })) : null;
  const biggestUp = changes ? [...changes].sort((x, y) => y.delta - x.delta)[0] : null;

  const goalsDone = goals.filter((g) => g.status === "completed").length;
  const goalTitle = new Map(goals.map((g) => [g.id, g.goal_title?.trim() ?? "your goal"]));

  const events: Event[] = [
    ...audits.map((a) => ({ date: a.completed_at as string, kind: "audit" as const, title: `Audit · ${a.total_score ?? 0}/100` })),
    ...goals.map((g) => ({ date: g.created_at as string, kind: "goal" as const, title: "Goal set", detail: g.goal_title?.trim() ?? undefined })),
    ...goals
      .filter((g) => g.status === "completed")
      .map((g) => ({ date: (g.updated_at ?? g.created_at) as string, kind: "done" as const, title: "Goal done", detail: g.goal_title?.trim() ?? undefined })),
    ...checkIns.map((c) => ({
      date: c.created_at,
      kind: "checkin" as const,
      title: `Check-in · ${c.area_score}/10`,
      detail: goalTitle.get(c.goal_id),
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My journey</div>
      <h1 className="au-latest-h">
        {changes && biggestUp && biggestUp.delta > 0
          ? `${biggestUp.name} is up ${biggestUp.delta} since your last audit.`
          : audits.length > 1
            ? "Here’s how your life has moved."
            : "Your journey starts here."}
      </h1>
      <p className="lead">
        {audits.length > 1
          ? `${audits.length} audits since ${formatDate(first.completed_at)}. Every point of change below came from something you did.`
          : `This is your first snapshot. After your next audit, around ${formatDate(nextAuditDue(latest.completed_at))}, you’ll see what’s moved.`}
      </p>

      <div className="journey-stats">
        <div><b>{audits.length}</b><span>{audits.length === 1 ? "audit" : "audits"}</span></div>
        <div><b>{latest.total_score ?? 0}</b><span>latest, out of 100</span></div>
        <div><b>{goalsDone}</b><span>{goalsDone === 1 ? "goal done" : "goals done"}</span></div>
        <div><b>{checkIns.length}</b><span>{checkIns.length === 1 ? "check-in" : "check-ins"}</span></div>
      </div>

      <div className="journey-grid">
        <section className="au-chart" aria-label="Your life map over time">
          <div className="au-chart-top">
            <strong>{before ? "Then and now" : "Your life map"}</strong>
            <span>Scale 1–10</span>
          </div>
          <LifeMap
            scores={now}
            compareScores={before ?? undefined}
            names={areas.map((a) => a.name)}
            labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
            title={before ? "Life map now, with your previous audit as a dashed outline" : "Your life map"}
          />
          {before && previous ? (
            <p className="au-chart-caption">
              Gold: now ({formatDate(latest.completed_at)}). Dashed: {formatDate(previous.completed_at)}.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="journey-areas-h">
          <h2 id="journey-areas-h" className="sec-head">{changes ? "How each area moved" : "Where each area is"}</h2>
          <ol className="journey-areas">
            {areas.map((a, i) => {
              const d = changes ? changes[i].delta : 0;
              return (
                <li key={a.id}>
                  <span className="journey-name">{a.name}</span>
                  {changes ? <span className="journey-was">{changes[i].before} →</span> : null}
                  <span className="journey-now">{now[i]}/10</span>
                  {changes ? (
                    <span className={`journey-delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`}>
                      {d > 0 ? `+${d}` : d < 0 ? `${d}` : "—"}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="clear-review" aria-labelledby="journey-timeline-h">
        <h2 id="journey-timeline-h" className="sec-head">Along the way</h2>
        <ol className="journey-timeline">
          {events.map((e, i) => (
            <li key={i} className={e.kind}>
              <span className="journey-dot" aria-hidden="true" />
              <div>
                <p className="journey-when">{formatDate(e.date)}</p>
                <p className="journey-title">{e.title}</p>
                {e.detail ? <p className="journey-detail">{e.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
