import Link from "next/link";
import { getLatestCompletedAudit } from "@/lib/actions/audit";
import { getCurrentProfile } from "@/lib/session";

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
            <div className="ring-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="62" fill="none" stroke="var(--bg4)" strokeWidth="10" />
                <circle cx="70" cy="70" r="62" fill="none" stroke="var(--gold)" strokeWidth="10" strokeLinecap="round" />
              </svg>
              <div className="ring-inner">
                <div className="ring-num" style={{ fontSize: "34px" }}>{audit.total_score}</div>
                <div className="ring-den">/ 100</div>
              </div>
            </div>
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
