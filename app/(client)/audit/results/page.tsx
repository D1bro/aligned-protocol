import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit } from "@/lib/actions/audit";

export default async function ResultsPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "4rem" }}>
      <div className="eyebrow"><span className="eydot" /> Your results</div>

      <div className="ring-wrap" style={{ margin: "1.5rem 0" }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--bg4)" strokeWidth="14" />
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--gold)" strokeWidth="14" strokeLinecap="round" />
        </svg>
        <div className="ring-inner">
          <div className="ring-num" style={{ fontSize: "64px" }}>{audit.total_score}</div>
          <div className="ring-den">out of 100</div>
        </div>
      </div>

      <h1>You&apos;ve just done the hard part.</h1>
      <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
        Your Aligned profile is saved. Duane personally reads every completed audit and will be in touch
        about what happens next.
      </p>

      {audit.focus_area ? <div className="focus-badge">Focus area: {audit.focus_area}</div> : null}

      <div style={{ marginTop: "2rem" }}>
        <Link href="/" className="btn btn-p">Go to my dashboard</Link>
      </div>
    </div>
  );
}
