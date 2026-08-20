import Link from "next/link";
import {
  getLatestCompletedAudit,
  getRecentCompletedAudits,
  getAuditWithResponses,
  getLifeAreas,
} from "@/lib/actions/audit";
import { getClearPlanForAudit, getGoalForPlan, getActiveGoals } from "@/lib/actions/clear";
import { getCurrentProfile } from "@/lib/session";
import { ScoreRing } from "@/components/ui/ScoreRing";

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Building";
  return "Early days";
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const audit = await getLatestCompletedAudit();

  if (!audit) {
    return (
      <div className="page">
        <div className="eyebrow"><span className="eydot" /> Dashboard</div>
        <h1>{profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Welcome back"}</h1>
        <p className="lead">
          You haven&apos;t completed an Aligned Audit yet. It takes about twenty minutes — ten honest
          questions about where your life actually stands right now.
        </p>
        <Link href="/audit" className="btn btn-p">Start the Audit</Link>
      </div>
    );
  }

  const [recent, { responses }, areas, goals] = await Promise.all([
    getRecentCompletedAudits(2),
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getActiveGoals(),
  ]);

  const previous = recent[1];
  const delta = previous ? (audit.total_score ?? 0) - (previous.total_score ?? 0) : null;

  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const strongCount = areas.filter((a) => (scoreByArea.get(a.id) ?? 0) >= 7).length;
  const priorityCount = areas.filter((a) => (scoreByArea.get(a.id) ?? 0) <= 4).length;

  const focusArea = audit.focus_area_id ? areas.find((a) => a.id === audit.focus_area_id) : null;

  // Read-only status check — does NOT create a clear_plans row just because
  // the dashboard was viewed. That only happens when someone actually opens
  // /clear (see lib/actions/clear.ts).
  let clearStatus: "not_started" | "in_progress" | "done" = "not_started";
  if (focusArea) {
    const plan = await getClearPlanForAudit(audit.id);
    if (plan) {
      const goal = await getGoalForPlan(plan.id);
      if (goal?.frequency && goal?.success_criteria) {
        clearStatus = "done";
      } else if (plan.current_reality || plan.life_vision || plan.emotional_blocks || goal) {
        clearStatus = "in_progress";
      }
    }
  }

  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> Dashboard</div>
      <h1>{profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Welcome back"}</h1>

      <div className="g2" style={{ marginTop: "1.5rem" }}>
        <div className="card" style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <ScoreRing score={audit.total_score ?? 0} size={120} strokeWidth={9} labelSize={30} />
          <div>
            <div className="hbox-l" style={{ marginBottom: 4 }}>Life Alignment Score</div>
            <div style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              {scoreLabel(audit.total_score ?? 0)}
            </div>
            <div style={{ display: "flex", gap: "1rem", fontSize: 12, color: "var(--text3)", flexWrap: "wrap" }}>
              {delta !== null ? <span>{delta >= 0 ? "+" : ""}{delta} vs last audit</span> : null}
              <span>{strongCount} strong {strongCount === 1 ? "area" : "areas"}</span>
              <span>{priorityCount} priority {priorityCount === 1 ? "area" : "areas"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="hbox-l" style={{ marginBottom: 6 }}>Priority Focus</div>
          {focusArea ? (
            <>
              <div style={{ display: "flex", gap: ".75rem", alignItems: "center", marginBottom: ".5rem" }}>
                <div className="area-icon">{focusArea.icon}</div>
                <h3 style={{ margin: 0 }}>{focusArea.name}</h3>
              </div>
              <p className="body-t" style={{ marginBottom: "1rem" }}>{focusArea.description}</p>
              <Link href="/clear" className="btn btn-p">
                {clearStatus === "done"
                  ? "Review your CLEAR plan"
                  : clearStatus === "in_progress"
                    ? "Continue CLEAR"
                    : "Begin CLEAR →"}
              </Link>
            </>
          ) : (
            <p className="body-t">No focus area was set on your latest audit.</p>
          )}
        </div>
      </div>

      {goals.length > 0 && (
        <>
          <div className="sec-head">Active Goals</div>
          <div className="g2">
            {goals.map((g) => (
              <div key={g.id} className="card">
                <div className="hbox-l" style={{ marginBottom: 4 }}>
                  {g.goal_type === "primary" ? "Primary" : "Supporting"}{g.focus_area ? ` · ${g.focus_area}` : ""}
                </div>
                <h3 style={{ margin: "0 0 .35rem" }}>{g.goal_title}</h3>
                {g.action_text ? <p className="body-t" style={{ marginBottom: ".5rem" }}>{g.action_text}</p> : null}
                {g.frequency ? <div className="focus-badge">{g.frequency}</div> : null}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-head">Your ten areas</div>
      <div className="area-grid">
        {areas.map((a, i) => {
          const s = scoreByArea.get(a.id) ?? 0;
          return (
            <div key={a.id} className="area-card" style={{ cursor: "default" }}>
              <span className="area-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="area-info">
                <span className="area-name">{a.name}</span>
                <div className="area-btrack">
                  <div className="area-bfill" style={{ width: `${s * 10}%` }} />
                </div>
              </span>
              <span aria-hidden="true" style={{ fontSize: 12, color: "var(--text3)", marginTop: 2, flexShrink: 0 }}>
                {s}/10
              </span>
            </div>
          );
        })}
      </div>

      <div className="div" />
      <Link href="/audit" className="btn btn-o">Retake the audit</Link>
    </div>
  );
}
