import Link from "next/link";
import { getClientPreview } from "@/lib/client-preview";
import { CoachingCard } from "@/components/profile/CoachingCard";
import { MemberCoaching } from "@/components/coaching/MemberCoaching";
import { BuySessions } from "@/components/coaching/BuySessions";
import { MemberInvoices } from "@/components/coaching/MemberInvoices";

// "See as client": the client's own coaching pages, with their data, made
// read-only (inert) so nothing can be done on their behalf.
export default async function ClientPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getClientPreview(id);
  const name = p.client.full_name || p.client.email || "This client";
  const first = p.client.full_name?.trim().split(/\s+/)[0] || "they";
  const coached = p.coaching.available && (p.coaching.sessions.length > 0 || p.coaching.summaries.length > 0);
  const credits = p.coaching.sessions.length ? p.billing.credits : null;
  const shown =
    coached || p.packages.length > 0 || p.billing.invoices.length > 0 || p.billing.credits.balance > 0;

  return (
    <div className="page admin-page">
      <Link href={`/coach/clients/${id}`} className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>
        ← Back to {name}
      </Link>
      <div className="cpv-banner" role="note">
        <p className="cpv-k">Preview · read-only</p>
        <h1>What {first === "they" ? "they see" : `${first} sees`}</h1>
        <p>
          Their coaching card on My profile and their Coaching page, with their real data. Buttons are switched off here.
          Not shown, because {first === "they" ? "they don’t" : `${first} doesn’t`} see them: your private notes, transcripts,
          reflections and any summary you haven&rsquo;t shared.{" "}
          {first === "they" ? "Their" : `${first}’s`} own unshared preparation is private to them, so it&rsquo;s blank here.
          {p.viewerBills ? "" : " Invoices, and packages offered only to selected clients, show for billing admins only."}
        </p>
      </div>

      {shown ? (
        <div className="cpv-frame" inert>
          {coached ? (
            <>
              <p className="cpv-where">My profile</p>
              <div className="cpv-screen">
                <CoachingCard data={p.coaching} goals={p.goals} hasGoal={p.goals.length > 0} credits={credits} />
              </div>
            </>
          ) : null}
          <p className="cpv-where">Coaching page</p>
          <div className="cpv-screen">
            {coached ? <MemberCoaching data={p.coaching} /> : null}
            <BuySessions packages={p.packages} credits={p.billing.available ? p.billing.credits : null} expiries={p.expiries} coached={coached} />
            <MemberInvoices data={p.billing} justPaid={false} />
            {!coached ? <p className="admin-card-sub">No sessions or shared summaries yet, so their Coaching page shows the general introduction to coaching.</p> : null}
          </div>
        </div>
      ) : (
        <p className="plan-note">
          Nothing from coaching to show yet. Until there&rsquo;s a session, a shared summary or a package on offer,{" "}
          {first === "they" ? "they see" : `${first} sees`} the general introduction to coaching.
        </p>
      )}
    </div>
  );
}
