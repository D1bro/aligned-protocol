import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { nextAuditDue } from "@/lib/audit-schedule";
import type { PlanCardProps } from "@/components/audit/PlanCard";
import { createClient } from "@/lib/supabase/server";
import { AREA_GUIDES, AREA_SHORT_NAMES, CLOSING_GUIDE } from "@/lib/audit-guides";
import type { SnapshotArea } from "@/components/audit/SnapshotView";
import type { StartArea } from "@/components/audit/StartingPoint";
import { ResultsBody } from "@/components/audit/ResultsBody";
import { ProfileOffer } from "@/components/site/ProfileOffer";

export default async function ResultsPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  // Guests get the same full results as everyone else; saving their starting
  // point is what invites them to create an account and keep it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user?.is_anonymous ?? false;

  const [{ responses }, areas, planState] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getPlanState(audit.id),
  ]);
  const { plan, goal, stage, step } = planState;
  const byArea = new Map(responses.map((r) => [r.life_area_id, r]));

  // Built from the person's actual saved answers, in audit order.
  const startAreas: StartArea[] = areas.map((a) => {
    const r = byArea.get(a.id);
    return {
      id: a.id,
      name: a.name,
      score: (r?.satisfaction_score as number | undefined) ?? 0,
      note: ((r?.note as string | null | undefined) ?? "").trim() || null,
    };
  });
  const snapshot: SnapshotArea[] = areas.map((a, i) => ({
    name: a.name,
    short: AREA_SHORT_NAMES[a.sort_order] ?? a.name,
    score: startAreas[i].score,
    note: startAreas[i].note,
    prompt: AREA_GUIDES[a.sort_order]?.prompt ?? null,
  }));
  const total = snapshot.reduce((sum, a) => sum + a.score, 0);

  // Starting area: what they saved, else (older audits) their original focus,
  // else the first of their lowest scores.
  const lowestScore = Math.min(...startAreas.map((a) => a.score));
  const initialAreaId =
    plan?.life_area_id ?? audit.focus_area_id ?? startAreas.find((a) => a.score === lowestScore)!.id;

  // Once CLEAR has started, the snapshot shows their plan instead of asking
  // the starting-point question again.
  const planArea = areas.findIndex((a) => a.id === initialAreaId);
  const planCard: PlanCardProps | null =
    (stage === "in_progress" || stage === "done") && planArea !== -1
      ? {
          areaName: areas[planArea].name,
          score: startAreas[planArea].score,
          target: Math.min(10, plan?.step_up_target ?? startAreas[planArea].score + 1),
          stage,
          step,
          goalTitle: goal?.goal_title ?? null,
          frequency: goal?.frequency ?? null,
          nextAuditDue: nextAuditDue(audit.completed_at).toISOString(),
        }
      : null;

  const strongest = [...snapshot].sort((x, y) => y.score - x.score).slice(0, 3);

  return (
    <div className="page au-results">
      <div className="au-results-head">
        <div className="eyebrow"><span className="eydot" /> Your Aligned snapshot</div>
        <h1>Here&rsquo;s where you stand.</h1>
        <p className="lead">Ten areas. One honest picture. A clear place to start.</p>
        {isGuest ? null : (
          <p className="au-small">
            Scores are self-reported.{" "}
            <Link href="/learn/ten-areas" className="au-text-link">Understanding your ten areas</Link> (optional guide)
          </p>
        )}
      </div>

      <ResultsBody
        auditId={audit.id}
        startAreas={startAreas}
        snapshot={snapshot}
        initialAreaId={initialAreaId}
        initialAnswer={plan?.step_up_answer ?? ""}
        isGuest={isGuest}
        total={total}
        video={CLOSING_GUIDE}
        planCard={planCard}
      >
        <p className="au-strengths">
          <span>Already working for you:</span>{" "}
          {strongest.map((a, i) => (
            <span key={a.name}>
              <b>{a.name}</b> {a.score}/10{i < strongest.length - 1 ? " · " : ""}
            </span>
          ))}
          <span className="au-strengths-tail"> — strengths you can lean on while you work on your starting point.</span>
        </p>
      </ResultsBody>

      <section className="au-next" aria-labelledby="au-next-h">
        <h2 id="au-next-h" className="sec-head">What comes next</h2>
        <ol className="au-next-cards">
          {planCard ? (
            <li>
              <span className="au-step-n">01</span>
              <h3>Your starting point is set</h3>
              <p>{planCard.areaName}, from {planCard.score} towards {planCard.target}. Your plan builds on it.</p>
              <Link href="/clear" className="au-text-link">Open my plan</Link>
            </li>
          ) : (
            <li>
              <span className="au-step-n">01</span>
              <h3>Name your starting point</h3>
              <p>Answer the question above in your own words. It becomes the first step of your plan.</p>
              <a href="#step-up" className="au-text-link">Go to the question</a>
            </li>
          )}
          {isGuest ? (
            <li className="primary">
              <span className="au-step-n">02</span>
              {/* Until the starting point is saved, the button goes to the question (where saving happens). */}
              <ProfileOffer headingLevel={3} href={plan ? "/login?signup=1" : "#step-up"} />
            </li>
          ) : planCard?.stage === "done" ? (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Keep going with your action</h3>
              <p>Your plan is set. Small, steady repetitions are what move a score — check back on your plan as you go.</p>
              <Link href="/clear" className="btn btn-p">Open my plan</Link>
            </li>
          ) : (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Work on it with CLEAR</h3>
              <p>A short guided plan that turns your starting point into one clear goal you can act on this week.</p>
              <Link href="/clear" className="btn btn-p">Open CLEAR →</Link>
            </li>
          )}
          <li>
            <span className="au-step-n">03</span>
            <h3>Come back and compare</h3>
            <p>Monthly goal check-ins keep your plan honest. Revisit all ten areas in about three months, or sooner after a meaningful change, to see what&rsquo;s moved.</p>
            {isGuest ? null : <Link href="/" className="au-text-link">Go to my profile</Link>}
          </li>
        </ol>
      </section>
    </div>
  );
}
