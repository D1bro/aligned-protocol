import Link from "next/link";
import { getRecentCompletedAudits, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getAllGoals, getAllCheckIns } from "@/lib/actions/checkins";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { formatDate, nextAuditDue } from "@/lib/audit-schedule";
import { LifeMap } from "@/components/audit/LifeMap";
import { getLessonProgress } from "@/lib/actions/learn";
import { getMainGoal } from "@/lib/actions/goals";
import { PATHS } from "@/lib/learn-content";
import { AlignmentReviews } from "@/components/profile/AlignmentReviews";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getCurrentProfile } from "@/lib/session";

type Event = { date: string; kind: "audit" | "goal" | "done" | "checkin" | "lesson"; title: string; detail?: string };

const LESSON_TITLE = new Map(PATHS.flatMap((p) => p.lessons.map((l) => [l.slug, l.title] as const)));

// My journey: how their life map has changed between audits, how each area
// moved, and everything they've done along the way.
export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ compare?: string }> }) {
  const { compare } = await searchParams;
  // Daily Alignment reviews are Tier 2: staff only until Tier 2 exists.
  const alignment = canUseDailyAlignment((await getCurrentProfile())?.role);
  const [audits, areas, goals, checkIns, lessons, main] = await Promise.all([
    getRecentCompletedAudits(50),
    getLifeAreas(),
    getAllGoals(),
    getAllCheckIns(),
    getLessonProgress(),
    getMainGoal(),
  ]);

  if (!audits.length) {
    return (
      <div className="page au-page">
        <div className="eyebrow"><span className="eydot" /> My journey</div>
        <h1 className="au-latest-h">{alignment ? <>Your journey, at <em>your pace.</em></> : <>Your journey starts with <em>the audit.</em></>}</h1>
        <p className="lead">
          {alignment
            ? "Keep your weekly reflections here. Once you take the audit, you can also see how your life map changes over time."
            : "Once you’ve taken it, this page shows how your life map changes over time."}
        </p>
        <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
        {alignment ? <AlignmentReviews /> : null}
      </div>
    );
  }

  const latest = audits[0];
  // Compare with the previous audit, or one they choose as history grows.
  const previous = audits.slice(1).find((a) => a.id === compare) ?? audits[1] ?? null;
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

  // Two audits on the same day are told apart by their time.
  const sameDay = previous && formatDate(previous.completed_at) === formatDate(latest.completed_at);
  const when = (d: string) =>
    sameDay
      ? `${formatDate(d)}, ${new Date(d).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Europe/London" })}`
      : formatDate(d);

  const goalsDone = goals.filter((g) => g.status === "completed").length;
  const lessonsDone = lessons.filter((l) => l.completed_at);
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
      title: `Goal check-in · ${c.area_score}/10`,
      detail: goalTitle.get(c.goal_id),
    })),
    ...lessonsDone.map((l) => ({
      date: l.completed_at as string,
      kind: "lesson" as const,
      title: "Lesson completed",
      detail: LESSON_TITLE.get(l.lesson_slug),
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> My journey</div>
      <h1 className="au-latest-h">
        {changes && biggestUp && biggestUp.delta > 0
          ? `${biggestUp.name} is up ${biggestUp.delta} since ${previous?.id === audits[1]?.id ? "your last audit" : formatDate(previous!.completed_at)}.`
          : audits.length > 1
            ? "Here’s how your life has moved."
            : "Your journey starts here."}
      </h1>
      <p className="lead">
        {audits.length > 1
          ? `${audits.length} audits since ${formatDate(first.completed_at)}. Here’s how each area has changed between them, in your own self-reported scores, alongside what you’ve done.`
          : `This is your first snapshot. After your next audit, around ${formatDate(nextAuditDue(latest.completed_at))}, you’ll see what’s moved.`}
      </p>

      {alignment ? <AlignmentReviews /> : null}
      <div className="journey-stats">
        <div><b>{audits.length}</b><span>{audits.length === 1 ? "audit" : "audits"}</span></div>
        <div><b>{latest.total_score ?? 0}</b><span>latest, out of 100</span></div>
        <div><b>{goalsDone}</b><span>{goalsDone === 1 ? "goal done" : "goals done"}</span></div>
        <div><b>{checkIns.length}</b><span>{checkIns.length === 1 ? "goal check-in" : "goal check-ins"}</span></div>
        <div><b>{lessonsDone.length}</b><span>{lessonsDone.length === 1 ? "lesson done" : "lessons done"}</span></div>
      </div>

      {checkIns.length === 0 ? (
        <p className="plan-note">
          {main
            ? <>No goal check-ins yet. Your first one records what you did and what got in the way, and adds it here. <Link href="/clear/check-in">Do a goal check-in</Link></>
            : <>No goal check-ins yet. Set one goal in <Link href="/clear">My plan</Link> and your monthly goal check-ins will build your journey here.</>}
        </p>
      ) : null}

      <div className="journey-grid">
        <section className="au-chart" aria-label="Your life map over time">
          <div className="au-chart-top">
            <strong>{before ? "Then and now" : "Your life map"}</strong>
            <span>Self-reported · 1–10</span>
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
              Gold: now ({when(latest.completed_at)}). Dashed: {previous.id === audits[1]?.id ? "your previous audit" : "the audit you chose"} ({when(previous.completed_at)}).
            </p>
          ) : null}
          {audits.length > 2 ? (
            <form className="journey-compare" method="get">
              <label htmlFor="compare">Compare with</label>
              <select id="compare" name="compare" defaultValue={previous?.id}>
                {audits.slice(1).map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDate(a.completed_at)} · {a.total_score ?? 0}/100
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-g">Show</button>
            </form>
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
