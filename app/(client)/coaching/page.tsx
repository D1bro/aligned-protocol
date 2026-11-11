import { getMyEnquiries } from "@/lib/actions/learn";
import { formatDate } from "@/lib/audit-schedule";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { FILMS } from "@/lib/audit-guides";
import { FOCUS_SESSIONS, offerFor } from "@/lib/offers";
import { EnquiryForm } from "@/components/learn/EnquiryForm";
import { getMyCoaching, getMyGoalCards } from "@/lib/actions/member-coaching";
import { getMyCalibratedChart } from "@/lib/actions/calibration";
import { getLatestCompletedAudit } from "@/lib/actions/audit";
import { MemberCoaching } from "@/components/coaching/MemberCoaching";
import { getMyBilling } from "@/lib/actions/billing";
import { MemberInvoices } from "@/components/coaching/MemberInvoices";
import { BuySessions } from "@/components/coaching/BuySessions";
import { getMyCredits, getMyExpiries, getOfferedPackages } from "@/lib/actions/packages";
import { CoachingTabs, coachingTab } from "@/components/coaching/CoachingTabs";
import { getMyCoach } from "@/lib/actions/staff-profiles";
import { YourCoach } from "@/components/coaching/YourCoach";

// Aligned Focus, session by session (lib/offers.ts).
const SESSIONS = FOCUS_SESSIONS.map(([title, text]) => ({ title, text }));
const FOCUS = offerFor("focus");

const STATUS: Record<string, string> = {
  new: "Received",
  contacted: "We’ve been in touch",
  booked: "Booked",
  closed: "Closed",
};

// Coaching Studio: what coaching is here, Aligned Focus and an enquiry form.
export default async function CoachingPage({ searchParams }: { searchParams: Promise<{ paid?: string; tab?: string }> }) {
  const [enquiries, coaching, billing, sp, packages, credits, expiries, myCoach] = await Promise.all([
    getMyEnquiries(),
    getMyCoaching(),
    getMyBilling(),
    searchParams,
    getOfferedPackages(),
    getMyCredits(),
    getMyExpiries(),
    getMyCoach().catch(() => null),
  ]);
  const [goals, chart, audit] = coaching.available
    ? await Promise.all([getMyGoalCards().catch(() => []), getMyCalibratedChart().catch(() => null), getLatestCompletedAudit().catch(() => null)])
    : [[], null, null];
  // Coached: they have a coach, or sessions or summaries already. They see
  // their coaching, not the introduction and enquiry form for newcomers.
  const coached = !!myCoach || (coaching.available && (coaching.sessions.length > 0 || coaching.summaries.length > 0));
  const open = enquiries.find((e) => e.status === "new" || e.status === "contacted") ?? null;
  // Sessions and payments gets its own tab once there's anything to show there.
  const held = credits ? credits.available + credits.reserved : 0;
  const hasPayments = packages.length > 0 || held > 0 || (billing.available && billing.invoices.length > 0);
  const tab = hasPayments ? coachingTab(sp) : "coaching";
  const sessionsLeft = credits && hasPayments ? { available: credits.available, href: "/coaching?tab=payments" } : null;

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Coaching</div>
      {myCoach ? <YourCoach coach={myCoach} /> : null}
      {hasPayments ? <CoachingTabs base="/coaching" active={tab} coached={coached} /> : null}
      {tab === "payments" ? (
        <>
          <BuySessions packages={packages} credits={credits} expiries={expiries} coached={coached} />
          <MemberInvoices data={billing} justPaid={sp.paid === "1"} />
        </>
      ) : (
        <CoachingAbout coached={coached} coaching={coaching} sessionsLeft={sessionsLeft} goals={goals} chart={chart} auditDone={!!audit} enquiries={enquiries} open={open} />
      )}
    </div>
  );
}

// The coaching tab: their coaching (once it's started), then what coaching is and how to enquire.
function CoachingAbout({
  coached,
  coaching,
  sessionsLeft,
  goals,
  chart,
  auditDone,
  enquiries,
  open,
}: {
  coached: boolean;
  coaching: Awaited<ReturnType<typeof getMyCoaching>>;
  sessionsLeft: { available: number; href: string } | null;
  goals: Awaited<ReturnType<typeof getMyGoalCards>>;
  chart: Awaited<ReturnType<typeof getMyCalibratedChart>>;
  auditDone: boolean;
  enquiries: Awaited<ReturnType<typeof getMyEnquiries>>;
  open: Awaited<ReturnType<typeof getMyEnquiries>>[number] | null;
}) {
  if (coached) return <MemberCoaching data={coaching} sessionsLeft={sessionsLeft} goals={goals} chart={chart} auditDone={auditDone} />;
  return (
    <>
      <h1 className="au-latest-h">Work on it <em>together.</em></h1>
      <p className="lead">
        Coaching here is led by you. You bring what matters; we work out the next step together. It builds on your
        audit and your plan, so we start from where you already are — not from scratch.
      </p>

      {FILMS.C01 ? <GuideVideo clip={FILMS.C01} /> : null}

      <section className="coach-offer" aria-labelledby="focus-h">
        <div className="coach-offer-head">
          <div>
            <div className="eyebrow"><span className="eydot" /> {FOCUS.tagline}</div>
            <h2 id="focus-h">{FOCUS.name}</h2>
            <p>Twelve weeks with an Aligned Coach: four 60-minute sessions, agreed actions and a written summary after each, with Momentum and the daily practice included throughout.</p>
          </div>
          <div className="coach-price">
            <span>12 weeks</span>
            <b>{FOCUS.price}</b>
            <span>one payment</span>
          </div>
        </div>
        <ol className="coach-sessions">
          {SESSIONS.map((s, i) => (
            <li key={s.title}>
              <span aria-hidden="true">{i + 1}</span>
              <div>
                <b>{s.title}</b>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="au-small">
          Coaching isn&rsquo;t therapy, and it isn&rsquo;t being told what to do. It&rsquo;s focused time to think
          clearly, decide, and follow through.
        </p>
      </section>

      {open ? (
        <section className="au-sum-card coach-sent" aria-live="polite">
          <p className="au-detail-k">Your enquiry · {formatDate(open.created_at)}</p>
          <p><b>{STATUS[open.status]}.</b> An Aligned Coach will reply by email.</p>
        </section>
      ) : (
        <EnquiryForm />
      )}

      {enquiries.length > (open ? 1 : 0) ? (
        <p className="au-small learn-more">
          Earlier enquiries:{" "}
          {enquiries
            .filter((e) => e.id !== open?.id)
            .map((e) => `${formatDate(e.created_at)} (${STATUS[e.status].toLowerCase()})`)
            .join(", ")}
        </p>
      ) : null}
    </>
  );
}
