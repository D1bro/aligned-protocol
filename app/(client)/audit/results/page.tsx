import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { createClient } from "@/lib/supabase/server";
import { AREA_GUIDES, CLOSING_GUIDE } from "@/lib/audit-guides";
import { SnapshotView, type SnapshotArea } from "@/components/audit/SnapshotView";
import { GuideVideo } from "@/components/audit/GuideVideo";

export default async function ResultsPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  // is_anonymous tells us whether this is a guest who took the audit without
  // an account yet, or someone with a real, permanent account. Guests get the
  // same full results everyone else does — just with a prompt to save them.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user?.is_anonymous ?? false;

  const [{ responses }, areas] = await Promise.all([getAuditWithResponses(audit.id), getLifeAreas()]);
  const byArea = new Map(responses.map((r) => [r.life_area_id, r]));

  // Built from the person's actual saved answers, in audit order.
  const snapshot: SnapshotArea[] = areas.map((a) => {
    const r = byArea.get(a.id);
    return {
      name: a.name,
      score: (r?.satisfaction_score as number | undefined) ?? 0,
      note: (r?.note as string | null | undefined) ?? null,
      prompt: AREA_GUIDES[a.sort_order]?.prompt ?? null,
    };
  });
  // Audits taken before the focus question was removed still show their focus.
  const focusIdx = areas.findIndex((a) => a.id === audit.focus_area_id);
  const focusIndex = focusIdx === -1 ? null : focusIdx;
  const total = snapshot.reduce((sum, a) => sum + a.score, 0);

  // Summary: the three highest and three lowest scores (ties keep audit order).
  const ranked = snapshot.map((a, i) => ({ ...a, i }));
  const strongest = [...ranked].sort((x, y) => y.score - x.score || x.i - y.i).slice(0, 3);
  const attention = [...ranked].sort((x, y) => x.score - y.score || x.i - y.i).slice(0, 3);
  const noteCount = snapshot.filter((a) => a.note?.trim()).length;

  return (
    <div className="page au-results">
      <div className="au-results-head">
        <div>
          <div className="eyebrow"><span className="eydot" /> Your Aligned snapshot</div>
          <h1>Here&rsquo;s where you stand.</h1>
          <p className="lead">Ten areas. One honest picture. A clear place to start.</p>
        </div>
        <div className="au-total" aria-label={`Overall ${total} out of 100`}>
          <b>{total}</b>
          <span>overall, out of 100</span>
        </div>
      </div>

      <SnapshotView areas={snapshot} focusIndex={focusIndex} />

      <section className="au-summary" aria-labelledby="au-summary-h">
        <h2 id="au-summary-h" className="sec-head">Your summary</h2>
        <div className="au-summary-grid">
          <div className="au-sum-card">
            <h3>Feeling strongest</h3>
            <ul>
              {strongest.map((a) => (
                <li key={a.name}><span>{a.name}</span><b>{a.score}/10</b></li>
              ))}
            </ul>
          </div>
          <div className="au-sum-card">
            <h3>Asking for more attention</h3>
            <ul>
              {attention.map((a) => (
                <li key={a.name}><span>{a.name}</span><b>{a.score}/10</b></li>
              ))}
            </ul>
          </div>
          <div className="au-sum-card">
            <h3>Your notes</h3>
            <p>
              {noteCount === 0
                ? "You didn’t add notes this time. Next time, a line or two on what’s working and what feels difficult makes this snapshot easier to come back to."
                : `You added notes to ${noteCount} of ${snapshot.length} areas. Select any area above to read them again — your own words are often more useful than the numbers.`}
            </p>
          </div>
        </div>
      </section>

      <section className="au-next" aria-labelledby="au-next-h">
        <h2 id="au-next-h" className="sec-head">What comes next</h2>
        <div className="au-next-grid">
          <GuideVideo clip={CLOSING_GUIDE} />
          <ol className="au-steps">
            <li>
              <span className="au-step-n">01</span>
              <div>
                <h3>Save your snapshot</h3>
                {isGuest ? (
                  <>
                    <p>Right now it&rsquo;s only saved in this browser. Create a free account to keep it on your profile and come back to it any time.</p>
                    <Link href="/login?signup=1" className="btn btn-p">Create a free account</Link>
                  </>
                ) : (
                  <p>It&rsquo;s saved to your profile, so you can come back to it, reflect on it and see how it changes.</p>
                )}
              </div>
            </li>
            <li>
              <span className="au-step-n">02</span>
              <div>
                <h3>Choose where to start</h3>
                <p>
                  When you&rsquo;re ready, pick one area to develop with CLEAR — a short guided plan that turns where you
                  are now into one clear goal.
                </p>
                {isGuest ? (
                  <p className="au-step-muted">Available once your snapshot is saved to an account.</p>
                ) : (
                  <Link href="/clear" className="btn btn-o">Choose where to start →</Link>
                )}
              </div>
            </li>
            <li>
              <span className="au-step-n">03</span>
              <div>
                <h3>Come back and compare</h3>
                <p>Retake the audit in a few weeks to see what&rsquo;s moved since this snapshot.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
