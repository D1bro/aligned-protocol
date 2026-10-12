import Link from "next/link";
import {
  getLatestCompletedAudit,
  getRecentCompletedAudits,
  getAuditWithResponses,
  getLifeAreas,
} from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { getCurrentProfile } from "@/lib/session";
import { SnapshotView } from "@/components/audit/SnapshotView";
import { PlanCard } from "@/components/audit/PlanCard";
import { AREA_GUIDES, AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { AUDIT_EVERY_LABEL, daysUntil, formatDate, nextAuditDue } from "@/lib/audit-schedule";

// Home: what's next for this person, their plan, and their life map — the
// one place that always reflects where they are in the loop
// (audit -> snapshot -> CLEAR -> act -> next audit).
export default async function HomePage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.full_name?.split(" ")[0];
  const audit = await getLatestCompletedAudit();

  if (!audit) {
    return (
      <div className="page au-page">
        <div className="eyebrow"><span className="eydot" /> Home</div>
        <h1 className="au-latest-h">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="lead">
          Start with the Aligned audit: ten honest questions about where your life stands right now. It takes about
          ten minutes, and gives you a snapshot and a clear place to start.
        </p>
        <Link href="/audit" className="btn btn-p">Begin my audit →</Link>
      </div>
    );
  }

  const [recent, { responses }, areas, planState] = await Promise.all([
    getRecentCompletedAudits(2),
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
  ]);
  const { plan, goal, stage, step } = planState;

  const previous = recent[1];
  const delta = previous ? (audit.total_score ?? 0) - (previous.total_score ?? 0) : null;
  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const noteByArea = new Map(responses.map((r) => [r.life_area_id, (r.note as string | null) ?? null]));
  const snapshot = areas.map((a) => ({
    name: a.name,
    short: AREA_SHORT_NAMES[a.sort_order] ?? a.name,
    score: scoreByArea.get(a.id) ?? 0,
    note: noteByArea.get(a.id) ?? null,
    prompt: AREA_GUIDES[a.sort_order]?.prompt ?? null,
  }));

  const areaId = plan?.life_area_id ?? audit.focus_area_id ?? null;
  const areaIdx = areaId ? areas.findIndex((a) => a.id === areaId) : -1;
  const area = areaIdx !== -1 ? areas[areaIdx] : null;
  const areaScore = area ? (scoreByArea.get(area.id) ?? 0) : 0;
  const target = Math.min(10, plan?.step_up_target ?? areaScore + 1);

  const due = nextAuditDue(audit.completed_at);
  const days = daysUntil(due);

  // The single most useful thing to do next.
  const next =
    days <= 0
      ? { title: "Your next audit is due", body: "It’s been around three months. Take the audit again to see what’s moved.", href: "/audit/1", cta: "Retake the audit →" }
      : !area
        ? { title: "Choose where to start", body: "Pick one area from your snapshot to develop with CLEAR.", href: "/clear", cta: "Choose an area →" }
        : stage === "done"
          ? {
              title: "Keep going with your action",
              body: `${goal?.frequency?.trim() ? `${goal.frequency.trim()}: ` : ""}${goal?.goal_title?.trim() || "your plan"}. Small, steady repetitions are what move a score.`,
              href: "/clear",
              cta: "Open my plan",
            }
          : stage === "in_progress"
            ? { title: `Finish your plan for ${area.name}`, body: `You’re on step ${step} of 5 of CLEAR. Your answers are saved.`, href: "/clear", cta: "Continue CLEAR →" }
            : { title: `Make a plan for ${area.name}`, body: "CLEAR turns your starting point into one goal you can act on this week. About ten minutes.", href: "/clear", cta: "Begin CLEAR →" };

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Home</div>
      <h1 className="au-latest-h">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h1>

      <div className="home-top">
        <section className="home-next" aria-label="Next up">
          <div className="eyebrow"><span className="eydot" /> Next up</div>
          <h2>{next.title}</h2>
          <p>{next.body}</p>
          <Link href={next.href} className="btn btn-p">{next.cta}</Link>
        </section>

        <div className="home-side">
          {area ? (
            <PlanCard
              areaName={area.name}
              score={areaScore}
              target={target}
              stage={stage}
              step={step}
              goalTitle={goal?.goal_title ?? null}
              frequency={goal?.frequency ?? null}
              nextAuditDue={due.toISOString()}
              hideAction
            />
          ) : null}
          <section className="au-sum-card" aria-label="Your audit">
            <h3>Your latest audit</h3>
            <p className="au-latest-big">
              {audit.total_score ?? 0} <span>/ 100</span>
            </p>
            <p>
              Taken {formatDate(audit.completed_at)}
              {delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} since the one before` : ""}. Next one{" "}
              {days <= 0 ? "is due now" : `around ${formatDate(due)}`} — we suggest {AUDIT_EVERY_LABEL}.
            </p>
          </section>
        </div>
      </div>

      <section className="au-snap" aria-labelledby="home-map-h">
        <h2 id="home-map-h" className="sec-head">Your life map</h2>
        <SnapshotView
          areas={snapshot}
          highlightIndex={areaIdx === -1 ? null : areaIdx}
          total={audit.total_score ?? undefined}
        />
      </section>
    </div>
  );
}
