import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import {
  changeMembership,
  confirmCheckout,
  getMomentumDetails,
  getMyMembership,
  openBillingPage,
  setMembershipCancelled,
} from "@/lib/actions/membership";
import { offerFor } from "@/lib/offers";
import { statusWords } from "@/lib/membership";
import { formatDate } from "@/lib/audit-schedule";
import { JoinButton } from "@/components/membership/JoinButton";
import { MomentumCard } from "@/components/membership/MomentumCard";

export const metadata: Metadata = { title: "My membership", robots: { index: false, follow: false } };

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

// My membership: what they have, what it costs, when it renews, and changing,
// cancelling or updating their card. Also where Stripe Checkout returns to.
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; changed?: string; cancelled?: string; kept?: string; error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const q = await searchParams;
  const joined = q.session_id ? await confirmCheckout(q.session_id) : null;
  const { access, current, past, open } = await getMyMembership();
  const momentum = access.tier === "momentum" ? await getMomentumDetails() : null;
  const offer = access.tier === "clarity" ? null : offerFor(access.tier);
  const other = current ? offerFor(current.tier === "practice" ? "momentum" : "practice") : null;

  return (
    <div className="page au-page ms-page">
      <div className="eyebrow"><span className="eydot" /> My membership</div>
      <h1 className="au-latest-h">{offer ? offer.name : "Aligned Clarity"}</h1>
      <p className="lead">{offer ? offer.tagline : "Free, always: your plan, your weekly and monthly reviews, and your dashboard."}</p>

      {joined?.ok ? <p className="clear-welcome" role="status"><b>Welcome to {offer?.name ?? "your membership"}.</b> Everything it includes is open now.</p> : null}
      {joined && !joined.ok && joined.message ? <p className="clear-err" role="alert">{joined.message}</p> : null}
      {q.changed ? <p className="clear-welcome" role="status"><b>Changed.</b> Your new membership starts now; Stripe adjusts this month&rsquo;s payment.</p> : null}
      {q.cancelled ? <p className="clear-welcome" role="status"><b>Cancelled.</b> You keep everything until the end of this month. Your plan, reviews and journal stay yours.</p> : null}
      {q.kept ? <p className="clear-welcome" role="status"><b>Your membership carries on.</b></p> : null}
      {q.error ? <p className="clear-err" role="alert">{q.error}</p> : null}

      {current ? (
        <section className="ms-card" aria-label="Your membership">
          <dl>
            <dt>Status</dt>
            <dd>{statusWords(current.status, current.cancel_at_period_end)}</dd>
            <dt>Price</dt>
            <dd>{pounds(current.price_pence)} a month{current.price_pence <= (offerFor(current.tier).pricePence ?? 0) ? " · founding price, kept while you stay a member" : ""}</dd>
            {current.current_period_end ? (
              <>
                <dt>{current.cancel_at_period_end ? "Ends" : "Next payment"}</dt>
                <dd>{formatDate(current.current_period_end)}</dd>
              </>
            ) : null}
            <dt>Member since</dt>
            <dd>{formatDate(current.started_at)}</dd>
          </dl>
          {current.status === "past_due" || current.status === "unpaid" ? (
            <p className="clear-err">Your last payment didn&rsquo;t go through. Update your card and Stripe will try again; you keep access meanwhile.</p>
          ) : null}
          <div className="ms-actions">
            {other && !current.cancel_at_period_end ? (
              <form action={changeMembership.bind(null, other.key as "practice" | "momentum")}>
                <button type="submit" className="btn btn-p">
                  {other.key === "momentum" ? `Move up to Momentum · ${other.price} ${other.per}` : `Move to Practice · ${other.price} ${other.per}`}
                </button>
              </form>
            ) : null}
            <form action={openBillingPage}>
              <button type="submit" className="btn btn-g">Update card and see invoices</button>
            </form>
            {current.cancel_at_period_end ? (
              <form action={setMembershipCancelled.bind(null, false)}>
                <button type="submit" className="btn btn-p">Keep my membership</button>
              </form>
            ) : (
              <form action={setMembershipCancelled.bind(null, true)}>
                <button type="submit" className="au-text-link as-btn">Cancel at the end of this month</button>
              </form>
            )}
          </div>
        </section>
      ) : access.source === "package" && access.until ? (
        <section className="ms-card" aria-label="Your membership">
          <p>Included with Aligned Focus until <b>{formatDate(access.until)}</b>. There&rsquo;s no automatic membership afterwards; you can choose to join then.</p>
        </section>
      ) : (
        <section className="ms-join" aria-label="Join">
          <p>Add a daily practice, or a live weekly hour with a small group. Cancel any time; your work always stays yours.</p>
          <div className="ms-actions">
            <JoinButton tier="practice" open={open} className="btn btn-g" />
            <JoinButton tier="momentum" open={open} />
          </div>
          <Link href="/offers" className="au-text-link">Compare the options, including Aligned Focus</Link>
        </section>
      )}

      {offer ? (
        <section className="ms-includes" aria-labelledby="ms-includes-h">
          <h2 id="ms-includes-h" className="pl-k">What&rsquo;s yours</h2>
          <ul>
            <li><Link href="/alignment">Daily intention and reflection</Link><span>Morning intention with Duane&rsquo;s audio, and an evening reflection</span></li>
            <li><Link href="/alignment/journal">Journal</Link><span>Private, with prompts if you want them</span></li>
            <li><Link href="/tools">Tools</Link><span>Values, identity and direction exercises</span></li>
            {access.tier === "momentum" ? <li><a href="#momentum">Your weekly session</a><span>A live hour with a small group</span></li> : null}
          </ul>
        </section>
      ) : null}

      {access.tier === "momentum" ? <div id="momentum"><MomentumCard details={momentum} /></div> : null}

      {past.length ? (
        <section className="ms-past" aria-labelledby="ms-past-h">
          <h2 id="ms-past-h" className="pl-k">Earlier memberships</h2>
          <ul>
            {past.map((m) => (
              <li key={m.id}>{offerFor(m.tier).name} · {pounds(m.price_pence)} a month · {formatDate(m.started_at)}{m.ended_at ? ` to ${formatDate(m.ended_at)}` : ""}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
