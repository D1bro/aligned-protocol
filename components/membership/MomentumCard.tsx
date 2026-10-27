import type { MomentumDetails } from "@/lib/actions/membership";

// Aligned Momentum: when the weekly session is and how to join it. Set by an
// admin in the console's Settings.
export function MomentumCard({ details }: { details: MomentumDetails | null }) {
  return (
    <section className="profile-card momentum-card" aria-labelledby="momentum-h">
      <h2 id="momentum-h">Your weekly session</h2>
      <p className="momentum-when">{details?.momentum_when || "Your session time will appear here soon."}</p>
      {details?.momentum_note ? <p className="admin-card-sub">{details.momentum_note}</p> : null}
      <p className="admin-card-sub">One hour: arrive, review your week, reflect, adjust, and set your next commitment. Speak, use the chat, or keep it as quiet time.</p>
      {details?.momentum_join_url ? (
        <a href={details.momentum_join_url} className="btn btn-p" target="_blank" rel="noopener noreferrer">Join the session →</a>
      ) : null}
    </section>
  );
}
