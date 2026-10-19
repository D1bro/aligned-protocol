import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { beginAudit, getInProgressAudit, getAuditWithResponses, getLifeAreas, getRecentCompletedAudits } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { PlanCard } from "@/components/audit/PlanCard";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_EVERY_LABEL, daysUntil, formatDate, nextAuditDue } from "@/lib/audit-schedule";
import { INTRO_GUIDE, AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { BrandMark } from "@/components/ui/BrandMark";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { LifeMap } from "@/components/audit/LifeMap";

// Demonstration values for the labelled example — never a real person's answers.
const EXAMPLE_SCORES = [8, 8, 8, 4, 8, 5, 8, 5, 6, 8];

export const metadata: Metadata = {
  title: "The Aligned audit",
  description: "Ten honest questions about ten areas of your life. Score how things feel today, add notes, and see a clear snapshot of where to start. Free, about ten minutes.",
  alternates: { canonical: "/audit" },
  robots: { index: true, follow: true },
};

// Entry point. Someone mid-audit is sent back to their first unanswered
// area. Someone who has already finished an audit sees their latest one and
// when the next is due (looking never starts a new audit — "Retake" does).
// Someone brand new sees the welcome and intro video.
export default async function AuditEntryPage({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
  const { intro } = await searchParams;
  // Someone who hasn't pressed "Begin" yet has no sign-in at all.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const [inProgress, recent, areas] = await Promise.all([
    user ? getInProgressAudit() : Promise.resolve(null),
    user ? getRecentCompletedAudits(2) : Promise.resolve([]),
    getLifeAreas(),
  ]);
  const responses = inProgress?.responses ?? [];

  const answeredIds = new Set(responses.map((r) => r.life_area_id));
  const firstUnanswered = areas.find((a) => !answeredIds.has(a.id));
  const resumeStep = firstUnanswered ? firstUnanswered.sort_order : areas.length; // all answered -> land on last

  // ?intro=1 is how Back from the first area returns here without being
  // bounced straight into the audit again.
  if (responses.length > 0 && intro !== "1") redirect(`/audit/${resumeStep}`);

  const latest = recent[0];
  if (latest && responses.length === 0 && intro !== "1") {
    return <LatestAudit audit={latest} previous={recent[1] ?? null} areas={areas} />;
  }

  return (
    <div className="page au-page">
      <div className="au-hero">
        <div>
          <div className="au-brand">
            <BrandMark width={34} />
            <div>
              <div className="au-brand-name">ALIGNED</div>
              <div className="au-brand-sub">PROTOCOL</div>
            </div>
          </div>
          <div className="eyebrow"><span className="eydot" /> The Aligned audit</div>
          <h1 className="au-hero-h">
            Ten honest questions.
            <br />
            One clear starting point.
          </h1>
          <p className="lead">
            A guided look at ten areas of your life. Score how things are right now, add your notes, and see where to
            focus first.
          </p>
          <div className="au-hero-actions">
            {responses.length > 0 ? (
              <Link href={`/audit/${resumeStep}`} className="btn btn-p">Continue my audit →</Link>
            ) : (
              <form action={beginAudit}>
                <button type="submit" className="btn btn-p">Begin my audit →</button>
              </form>
            )}
            <a href="#example" className="au-text-link">See an example snapshot</a>
          </div>
          <ol className="au-mini-steps">
            <li><b>01</b> Score ten areas</li>
            <li><b>02</b> Add your notes</li>
            <li><b>03</b> See your snapshot</li>
          </ol>
          <p className="au-small" style={{ marginTop: "1rem" }}>
            Free, and no account needed to start. Takes about 10 minutes.
          </p>
        </div>
        <GuideVideo clip={INTRO_GUIDE} caption="A guide from Duane: what you’re answering, how to score it, and the snapshot you’re working towards." />
      </div>

      <section id="example" className="au-example" aria-labelledby="au-example-h">
        <div className="au-example-copy">
          <span className="au-example-tag">Example</span>
          <h2 id="au-example-h">Your ten answers become a picture of where you stand.</h2>
          <p>
            This is a sample snapshot, not your results. Each spoke is one area, scored from the centre out to 10 at the
            edge. Yours is built from your own answers when you finish.
          </p>
        </div>
        <div className="au-example-map">
          <LifeMap
            scores={EXAMPLE_SCORES}
            names={areas.map((a) => a.name)}
            labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
            title="Example life map with sample scores"
          />
        </div>
      </section>
    </div>
  );
}

type Audit = { id: string; total_score: number | null; completed_at: string; focus_area_id: string | null };

// Returning person: their latest audit at a glance, and when to take the next.
async function LatestAudit({
  audit,
  previous,
  areas,
}: {
  audit: Audit;
  previous: Audit | null;
  areas: Awaited<ReturnType<typeof getLifeAreas>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user?.is_anonymous ?? false;
  const [{ responses }, planState] = await Promise.all([getAuditWithResponses(audit.id), getPlanState(audit.id)]);
  const { plan, goal, stage, step } = planState;

  const scoreBy = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const scores = areas.map((a) => scoreBy.get(a.id) ?? 0);
  const startId = plan?.life_area_id ?? audit.focus_area_id;
  const startIdx = startId ? areas.findIndex((a) => a.id === startId) : -1;
  const total = audit.total_score ?? scores.reduce((x, y) => x + y, 0);
  const change = previous?.total_score != null ? total - previous.total_score : null;

  const due = nextAuditDue(audit.completed_at);
  const days = daysUntil(due);

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Your Aligned audit</div>
      <h1 className="au-latest-h">Your latest snapshot</h1>
      <p className="lead">
        Taken {formatDate(audit.completed_at)} · Overall {total} / 100
        {change !== null ? ` · ${change >= 0 ? "+" : ""}${change} since your previous audit` : ""}
      </p>
      {isGuest ? null : (
        <p className="au-small" style={{ marginTop: "-.6rem", marginBottom: "1rem" }}>
          Scores are self-reported: how each area felt to you that day.{" "}
          <Link href="/learn/ten-areas" className="au-text-link">Understanding your ten areas</Link> (optional guide)
        </p>
      )}

      <div className="au-latest">
        <div className="au-chart">
          <LifeMap
            scores={scores}
            names={areas.map((a) => a.name)}
            labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
            highlightIndex={startIdx === -1 ? null : startIdx}
          />
        </div>

        <div className="au-latest-side">
          {startIdx !== -1 && (stage === "in_progress" || stage === "done") ? (
            <PlanCard
              areaName={areas[startIdx].name}
              score={scores[startIdx]}
              target={Math.min(10, plan?.step_up_target ?? scores[startIdx] + 1)}
              stage={stage}
              step={step}
              goalTitle={goal?.goal_title ?? null}
              frequency={goal?.frequency ?? null}
              nextAuditDue={due.toISOString()}
            />
          ) : startIdx !== -1 ? (
            <div className="au-sum-card">
              <h3>Where you&rsquo;re starting</h3>
              <p className="au-latest-big">
                {areas[startIdx].name} <span>{scores[startIdx]}/10</span>
              </p>
              {plan?.step_up_answer ? <p>&ldquo;{plan.step_up_answer}&rdquo;</p> : null}
            </div>
          ) : null}

          <div className={`au-sum-card${days <= 0 ? " due" : ""}`}>
            <h3>Suggested next whole-life audit</h3>
            <p className="au-latest-big">{days <= 0 ? "Now" : formatDate(due)}</p>
            <p>
              {days <= 0
                ? "It’s been around three months — a good time to revisit all ten areas."
                : `In ${days} day${days === 1 ? "" : "s"}. We suggest revisiting all ten areas ${AUDIT_EVERY_LABEL}. You can revisit earlier after a meaningful change.`}
            </p>
          </div>

          <div className="au-latest-actions">
            <Link href="/audit/results" className="btn btn-p">View my full snapshot</Link>
            {isGuest ? (
              <Link href="/login?signup=1" className="btn btn-o">Save it to a free profile</Link>
            ) : (
              <Link href="/clear" className="btn btn-o">Go to CLEAR</Link>
            )}
            <Link href="/audit/1" className="au-text-link">
              {days <= 0 ? "Retake the audit" : "Revisit early"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
