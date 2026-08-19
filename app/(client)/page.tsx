import Link from "next/link";
import { getLatestCompletedAudit } from "@/lib/actions/audit";
import { getCurrentProfile } from "@/lib/session";
import { ScoreRing } from "@/components/ui/ScoreRing";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const audit = await getLatestCompletedAudit();

  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> Dashboard</div>
      <h1>
        {profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Welcome back"}
      </h1>

      {!audit ? (
        <>
          <p className="lead">
            You haven&apos;t completed an Aligned Audit yet. It takes about twenty minutes — ten honest
            questions about where your life actually stands right now.
          </p>
          <Link href="/audit" className="btn btn-p">Start the Audit</Link>
        </>
      ) : (
        <>
          <div className="card" style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
            <ScoreRing score={audit.total_score ?? 0} size={140} strokeWidth={10} labelSize={34} />
            <div>
              <h3>Your Alignment Score</h3>
              <p className="body-t">
                Completed {new Date(audit.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              {audit.focus_area ? (
                <div className="focus-badge" style={{ marginTop: ".75rem" }}>Focus: {audit.focus_area}</div>
              ) : null}
            </div>
          </div>

          <div className="sec-head">What happens next</div>
          <p className="body-t">
            Duane personally reads every completed audit and will be in touch. In the meantime, the CLEAR
            process and goal-setting tools are being built out next.
          </p>

          <div className="div" />
          <Link href="/audit" className="btn btn-o">Start a new audit</Link>
        </>
      )}
    </div>
  );
}
