import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyCoaching } from "@/lib/actions/member-coaching";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime } from "@/lib/time";

type Content = { focus?: string; summary?: string; insights?: string[]; resources?: { title: string; url: string }[] };

// One shared session summary (what the coach published for this session).
export default async function MemberSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const data = await getMyCoaching();
  const summary = data.summaries.find((s) => s.session_id === sessionId);
  if (!summary) notFound();
  const session = data.sessions.find((s) => s.id === sessionId);
  const c = summary.content as Content;
  const steps = data.commitments.filter((x) => x.summary_id === summary.id);

  return (
    <div className="page au-page learn-lesson">
      <Link href="/coaching" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>← Coaching</Link>
      <div className="eyebrow"><span className="eydot" /> Session summary</div>
      <h1 className="au-latest-h">{c.focus || "Our session"}</h1>
      <p className="cp-sub">
        {session ? formatSessionTime(session.scheduled_at, session.timezone) : ""} · shared {formatDate(summary.published_at)}
      </p>
      {c.summary ? <p className="sw-p">{c.summary}</p> : null}
      {c.insights?.length ? (<><h2 className="sec-head">What you noticed</h2><ul className="mc-list">{c.insights.map((x, i) => <li key={i}>{x}</li>)}</ul></>) : null}
      {steps.length ? (
        <>
          <h2 className="sec-head">What we agreed</h2>
          <ul className="mc-list">
            {steps.map((s) => <li key={s.id}>{s.owner === "client" ? "You: " : "Your coach: "}{s.body}{s.due_date ? ` · by ${formatDate(s.due_date)}` : ""}</li>)}
          </ul>
        </>
      ) : null}
      {c.resources?.length ? (<><h2 className="sec-head">Resources</h2><ul className="mc-list">{c.resources.map((r, i) => <li key={i}>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</li>)}</ul></>) : null}
    </div>
  );
}
