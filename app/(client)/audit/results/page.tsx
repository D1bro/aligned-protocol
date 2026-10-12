import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getClearPlanForAudit } from "@/lib/actions/clear";
import { createClient } from "@/lib/supabase/server";
import { AREA_GUIDES, AREA_SHORT_NAMES, CLOSING_GUIDE } from "@/lib/audit-guides";
import type { SnapshotArea } from "@/components/audit/SnapshotView";
import type { StartArea } from "@/components/audit/StartingPoint";
import { ResultsBody } from "@/components/audit/ResultsBody";

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

  const [{ responses }, areas, plan] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
    getClearPlanForAudit(audit.id),
  ]);
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

  const strongest = [...snapshot].sort((x, y) => y.score - x.score).slice(0, 3);

  return (
    <div className="page au-results">
      <div className="au-results-head">
        <div className="eyebrow"><span className="eydot" /> Your Aligned snapshot</div>
        <h1>Here&rsquo;s where you stand.</h1>
        <p className="lead">Ten areas. One honest picture. A clear place to start.</p>
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
          <li>
            <span className="au-step-n">01</span>
            <h3>Name your starting point</h3>
            <p>Answer the question above in your own words. It becomes the first step of your plan.</p>
            <a href="#step-up" className="au-text-link">Go to the question</a>
          </li>
          {isGuest ? (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Build your profile</h3>
              <p>
                A free account keeps your snapshot, your notes and your starting point together, and opens CLEAR — a
                short guided plan that turns your starting point into one clear goal.
              </p>
              <Link href="/login?signup=1" className="btn btn-p">Create my free profile</Link>
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
            <p>Retake the audit in a few weeks. Seeing what&rsquo;s moved is where the momentum comes from.</p>
            {isGuest ? null : <Link href="/" className="au-text-link">Go to my profile</Link>}
          </li>
        </ol>
      </section>
    </div>
  );
}
