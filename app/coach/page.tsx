import Link from "next/link";
import { getMyClients } from "@/lib/actions/coach";
import { AddClientForm } from "./AddClientForm";

function scoreBadgeClass(score: number | null) {
  if (score === null) return "score-mid";
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-mid";
  return "score-low";
}

export default async function CoachPage() {
  const clients = await getMyClients();

  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> Coach dashboard</div>
      <h1>Your clients</h1>
      <p className="lead">
        {clients.length} client{clients.length === 1 ? "" : "s"} assigned to you. Add a new one below — they
        get an email invite to set their own password; your own session is never touched.
      </p>

      <AddClientForm />

      <div className="sec-head">Client roster</div>
      {clients.length === 0 ? (
        <div className="empty">No clients yet — add one above.</div>
      ) : (
        <div className="area-grid">
          {clients.map((c) => (
            <Link key={c.id} href={`/coach/clients/${c.id}`} className="client-card">
              <div className="c-name">{c.full_name || "Unnamed client"}</div>
              <div className="c-email">{c.email}</div>
              {c.latestScore !== null ? (
                <span className={`score-badge ${scoreBadgeClass(c.latestScore)}`}>{c.latestScore}/100</span>
              ) : (
                <span className="score-badge score-mid">No audit yet</span>
              )}
              {c.focusArea ? (
                <div className="body-t" style={{ marginTop: ".5rem" }}>Focus: {c.focusArea}</div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
