import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { formatDate, nextAuditDue } from "@/lib/audit-schedule";
import type { PlanCardProps } from "@/components/audit/PlanCard";
import { createClient } from "@/lib/supabase/server";
import { AREA_GUIDES, AREA_SHORT_NAMES, CLOSING_GUIDE, FILMS } from "@/lib/audit-guides";
import type { SnapshotArea } from "@/components/audit/SnapshotView";
import type { StartArea } from "@/components/audit/StartingPoint";
import { ResultsBody } from "@/components/audit/ResultsBody";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { SaveStart } from "@/components/audit/SaveStart";
import { TEN_AREAS_SHOWN } from "@/lib/learn-content";

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
    order: a.sort_order,
  }));
  const total = snapshot.reduce((sum, a) => sum + a.score, 0);

  // Starting area: what they saved, else (older audits) their original focus,
  // else the first of their lowest scores.
  const lowestScore = Math.min(...startAreas.map((a) => a.score));
  const initialAreaId =
    plan?.life_area_id ?? audit.focus_area_id ?? startAreas.find((a) => a.score === lowestScore)!.id;

  // Once the plan has started, the snapshot shows their plan instead of asking
  // the starting-point question again.
  const planArea = areas.findIndex((a) => a.id === initialAreaId);
  const planCard: PlanCardProps | null =
    (stage === "in_progress" || stage === "done") && planArea !== -1
      ? {
          areaName: areas[planArea].name,
          score: startAreas[planArea].score,
          target: goal?.aim_score ?? null,
          stage,
          step,
          goalTitle: goal?.goal_title ?? null,
          frequency: goal?.frequency ?? null,
          nextAuditDue: nextAuditDue(audit.completed_at).toISOString(),
        }
      : null;

  const strongest = [...snapshot].sort((x, y) => y.score - x.score).slice(0, 3);
  const lowestSnap = Math.min(...snapshot.map((a) => a.score));

  return (
    <div className="page au-results">
      {/* The score and Duane's word on what to do with it come first. */}
      <div className="au-results-head">
        <div className="au-results-intro">
          <div className="eyebrow"><span className="eydot" /> Your Aligned snapshot</div>
          <h1>Here&rsquo;s where you <em>stand.</em></h1>
          <p className="lead">Ten areas. One honest picture. A clear place to start.</p>
          <div className="au-results-score">
            <ScoreRing score={total} size={112} strokeWidth={9} labelSize={30} denomLabel="/100" />
            <dl className="profile-score-facts">
              <dt className="eyebrow">Whole-life score</dt>
              <dd>Taken <b>{formatDate(audit.completed_at)}</b></dd>
              {strongest[0].score === lowestSnap ? (
                <dd>All ten areas <b>{lowestSnap}/10</b></dd>
              ) : (
                <dd>Strongest <b>{strongest.map((a) => a.short).join(" · ")}</b></dd>
              )}
              {planArea !== -1 ? <dd>Starting point <b>{snapshot[planArea].short}</b></dd> : null}
            </dl>
          </div>
          {isGuest ? null : (
            <p className="au-small">
              Scores are self-reported.
              {TEN_AREAS_SHOWN ? <>{" "}<Link href="/learn/ten-areas" className="au-text-link">Understanding your ten areas</Link> (optional guide)</> : null}
            </p>
          )}
        </div>
        {isGuest ? null : <GuideVideo clip={CLOSING_GUIDE} caption="Duane on reading your snapshot and choosing where to start · about 3 minutes" />}
      </div>

      <ResultsBody
        auditId={audit.id}
        startAreas={startAreas}
        snapshot={snapshot}
        initialAreaId={initialAreaId}
        initialAnswer={plan?.current_reality ?? ""}
        isGuest={isGuest}
        total={total}
        planCard={planCard}
      >
        {/* Guests: keeping their results is the one next step, straight
            after the map; Duane's film follows it. */}
        {isGuest ? (
          <>
            <SaveStart
              skipHref={planCard ? "/next-step" : "#step-up"}
              film={FILMS.S01 ? (
                <GuideVideo
                  clip={FILMS.S01}
                  caption={
                    <>
                      Duane on saving your starting point · 40 seconds
                      {/* The music's CC BY 4.0 licence asks for this credit beside the film. */}
                      <small className="au-video-credit">
                        Music: &ldquo;<a href="https://www.scottbuckley.com.au/library/hymn-to-the-dawn/">Hymn To The Dawn</a>&rdquo; by Scott Buckley,{" "}
                        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Excerpted and faded.
                      </small>
                    </>
                  }
                />
              ) : null}
            />
            <div className="ss-after">
              <GuideVideo clip={CLOSING_GUIDE} caption="Duane on reading your snapshot and choosing where to start · about 3 minutes" />
            </div>
          </>
        ) : null}
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

      {isGuest ? null : (
      <section className="au-next" aria-labelledby="au-next-h">
        <h2 id="au-next-h" className="sec-head">What comes next</h2>
        <ol className="au-next-cards">
          {planCard ? (
            <li>
              <span className="au-step-n">01</span>
              <h3>Your starting point is set</h3>
              <p>{planCard.areaName}, from {planCard.score}. Your Next Step builds on it.</p>
              <Link href="/next-step" className="au-text-link">Open The Next Step</Link>
            </li>
          ) : (
            <li>
              <span className="au-step-n">01</span>
              <h3>Name your starting point</h3>
              <p>Answer the question above in your own words. It&rsquo;s the first of five short screens to your Next Step.</p>
              <a href="#step-up" className="au-text-link">Go to the question</a>
            </li>
          )}
          {isGuest ? (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Find your Next Step</h3>
              <p>Five short screens find the one change that gets you unstuck. Set it first; save it to a free account when it&rsquo;s set.</p>
              <a href={plan ? "/next-step" : "#step-up"} className="btn btn-p">Find my Next Step →</a>
            </li>
          ) : planCard?.stage === "done" ? (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Keep going with your moves</h3>
              <p>Your Next Step is set. Tick off your moves as you go, and check in each week.</p>
              <Link href="/next-step" className="btn btn-p">Open The Next Step</Link>
            </li>
          ) : (
            <li className="primary">
              <span className="au-step-n">02</span>
              <h3>Find your Next Step</h3>
              <p>Five short screens find the one change that gets you out of where you&rsquo;re stuck.</p>
              <Link href="/next-step" className="btn btn-p">Find my Next Step →</Link>
            </li>
          )}
          <li>
            <span className="au-step-n">03</span>
            <h3>Come back and compare</h3>
            <p>A one-minute weekly check-in keeps your Next Step moving, and you score the area again once it&rsquo;s taken. Revisit all ten areas in about three months, or sooner after a meaningful change, to see what&rsquo;s moved.</p>
            {isGuest ? null : <Link href="/" className="au-text-link">Go to My Space</Link>}
          </li>
        </ol>
      </section>
      )}
    </div>
  );
}
