import Link from "next/link";
import { redirect } from "next/navigation";
import { startOrResumeAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";

// Entry point. Someone already mid-audit (or resuming/retaking) is sent
// straight back to their first unanswered area, same as before. Someone
// brand new — most guests, since this is now the front door for anyone
// without an account — sees a short intro first instead of being dropped
// straight into a wall of rating buttons with no context for what this is.
export default async function AuditEntryPage() {
  const auditId = await startOrResumeAudit();
  const [{ responses }, areas] = await Promise.all([getAuditWithResponses(auditId), getLifeAreas()]);

  if (responses.length > 0) {
    const answeredIds = new Set(responses.map((r) => r.life_area_id));
    const firstUnanswered = areas.find((a) => !answeredIds.has(a.id));
    const targetStep = firstUnanswered ? firstUnanswered.sort_order : areas.length; // all answered -> land on last
    redirect(`/audit/${targetStep}`);
  }

  return (
    <div
      className="page"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "4rem", maxWidth: 560 }}
    >
      <div className="auth-logo" style={{ marginBottom: "1.5rem" }}>
        <svg width="44" height="41" viewBox="0 0 44 41" fill="none" aria-hidden="true">
          <path d="M22 2 L42 39" stroke="#E0B140" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M22 2 L2 39" stroke="#E0B140" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="22" cy="29" r="4.5" fill="#E0B140" />
        </svg>
        <div className="auth-logo-brand">ALIGNED</div>
        <div className="auth-logo-sub">PROTOCOL</div>
      </div>

      <div className="eyebrow"><span className="eydot" /> The Aligned Audit</div>
      <h1>Ten honest questions about where your life actually stands right now.</h1>
      <p className="lead" style={{ margin: "0 auto 2rem" }}>
        Rate {areas.length} areas of your life, then tell us which one matters most. A human coach —
        not an algorithm — reads every response. Takes about 10&ndash;15 minutes.
      </p>
      <Link href="/audit/1" className="btn btn-p">Begin the Audit →</Link>
    </div>
  );
}
