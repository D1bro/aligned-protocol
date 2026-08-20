import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { createClient } from "@/lib/supabase/server";
import { ScoreRing } from "@/components/ui/ScoreRing";

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

  const [{ responses }, areas] = await Promise.all([
    getAuditWithResponses(audit.id),
    getLifeAreas(),
  ]);
  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "4rem" }}>
      <div className="eyebrow"><span className="eydot" /> Your results</div>

      <div className="card-pop" style={{ margin: "1.5rem 0" }}>
        <ScoreRing score={audit.total_score ?? 0} size={220} strokeWidth={14} labelSize={64} denomLabel="out of 100" />
      </div>

      <h1>You&apos;ve just done the hard part.</h1>

      {isGuest ? (
        <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
          Here&apos;s exactly where you stand, honestly, across all ten areas. This is saved to your current
          session for now — create a free account to keep it permanently and pick up from here on any device.
        </p>
      ) : (
        <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
          Your Aligned profile is saved. Duane personally reads every completed audit and will be in touch
          about what happens next.
        </p>
      )}

      {audit.focus_area ? <div className="focus-badge">Focus area: {audit.focus_area}</div> : null}

      <div className="sec-head" style={{ width: "100%" }}>Your ten areas</div>
      <div className="area-grid" style={{ width: "100%", textAlign: "left" }}>
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

      <div style={{ marginTop: "2rem" }}>
        {isGuest ? (
          <Link href="/login?signup=1" className="btn btn-p">Create a free account to save this</Link>
        ) : (
          <Link href="/" className="btn btn-p">Go to my dashboard</Link>
        )}
      </div>
    </div>
  );
}
