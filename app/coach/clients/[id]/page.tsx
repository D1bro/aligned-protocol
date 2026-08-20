import Link from "next/link";
import { getClientDetail } from "@/lib/actions/coach";
import { SessionNoteForm } from "./SessionNoteForm";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, audits, goals, notes } = await getClientDetail(id);

  const latest = audits[0];

  return (
    <div className="page">
      <Link href="/coach" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>
        ← Back to roster
      </Link>
      <div className="eyebrow"><span className="eydot" /> Client</div>
      <h1>{client.full_name || "Unnamed client"}</h1>
      <p className="body-t" style={{ marginBottom: "1.5rem" }}>{client.email}</p>

      <div className="stat-grid">
        <div className="sc">
          <div className="sc-l">Latest score</div>
          <div className="sc-v">{latest ? `${latest.total_score}/100` : "—"}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Focus area</div>
          <div className="sc-v" style={{ fontSize: 14 }}>{latest?.focus_area || "—"}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Audits completed</div>
          <div className="sc-v">{audits.length}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Active goals</div>
          <div className="sc-v">{goals.length}</div>
        </div>
      </div>

      {goals.length > 0 && (
        <>
          <div className="sec-head">Active goals</div>
          {goals.map((g) => (
            <div key={g.id} className="card" style={{ marginBottom: ".75rem" }}>
              <div className="hbox-l" style={{ marginBottom: 4 }}>
                {g.goal_type === "primary" ? "Primary" : "Supporting"}{g.focus_area ? ` · ${g.focus_area}` : ""}
              </div>
              <h3 style={{ margin: "0 0 .35rem" }}>{g.goal_title}</h3>
              {g.action_text ? <p className="body-t">{g.action_text}</p> : null}
            </div>
          ))}
        </>
      )}

      <div className="sec-head">Session notes</div>
      <SessionNoteForm clientId={client.id} />

      {notes.length === 0 ? (
        <div className="empty">No session notes yet.</div>
      ) : (
        notes.map((n) => (
          <div key={n.id} className="track-row" style={{ marginTop: ".75rem" }}>
            <div className="track-head" style={{ cursor: "default" }}>
              <span>
                {new Date(n.session_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {n.focus ? <span className="tb-label">{n.focus}</span> : null}
            </div>
            <div className="track-body">
              <p className="body-t">{n.note}</p>
              {n.next_actions ? (
                <p className="body-t" style={{ marginTop: ".5rem" }}>
                  <strong>Next:</strong> {n.next_actions}
                </p>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
