import { getMyEnquiries } from "@/lib/actions/learn";
import { formatDate } from "@/lib/audit-schedule";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { FILMS, filmOrSoon } from "@/lib/audit-guides";
import { offerFor } from "@/lib/offers";
import { EnquiryForm } from "@/components/learn/EnquiryForm";
import { getMyCoaching } from "@/lib/actions/member-coaching";
import { MemberCoaching } from "@/components/coaching/MemberCoaching";
import { getMyBilling } from "@/lib/actions/billing";
import { MemberInvoices } from "@/components/coaching/MemberInvoices";
import { BuySessions } from "@/components/coaching/BuySessions";
import { getMyCredits, getMyExpiries, getOfferedPackages } from "@/lib/actions/packages";
import { CoachingTabs, coachingTab } from "@/components/coaching/CoachingTabs";

const SESSIONS = [
  { title: "Check and sharpen your plan", text: "We start from the plan you’ve built: what matters most right now, and the one action that will move it." },
  { title: "Work through what gets in the way", text: "Halfway through the six weeks: what’s worked, what hasn’t, and adjusting so it fits your life." },
  { title: "Review and continue", text: "What’s moved, what you’ve learned, and what comes next — with or without more coaching." },
];
const FOCUS = offerFor("focus");

const STATUS: Record<string, string> = {
  new: "Received",
  contacted: "We’ve been in touch",
  booked: "Booked",
  closed: "Closed",
};

// Coaching Studio: what coaching is here, Aligned Focus and an enquiry form.
export default async function CoachingPage({ searchParams }: { searchParams: Promise<{ paid?: string; tab?: string }> }) {
  const [enquiries, coaching, billing, sp, packages, credits, expiries] = await Promise.all([
    getMyEnquiries(),
    getMyCoaching(),
    getMyBilling(),
    searchParams,
    getOfferedPackages(),
    getMyCredits(),
    getMyExpiries(),
  ]);
  const coached = coaching.available && (coaching.sessions.length > 0 || coaching.summaries.length > 0);
  const open = enquiries.find((e) => e.status === "new" || e.status === "contacted") ?? null;
  // Sessions and payments gets its own tab once there's anything to show there.
  const held = credits ? credits.available + credits.reserved : 0;
  const hasPayments = packages.length > 0 || held > 0 || (billing.available && billing.invoices.length > 0);
  const tab = hasPayments ? coachingTab(sp) : "coaching";
  const sessionsLeft = credits && hasPayments ? { available: credits.available, href: "/coaching?tab=payments" } : null;

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Coaching</div>
      {hasPayments ? <CoachingTabs base="/coaching" active={tab} coached={coached} /> : null}
      {tab === "payments" ? (
        <>
          <BuySessions packages={packages} credits={credits} expiries={expiries} coached={coached} />
          <MemberInvoices data={billing} justPaid={sp.paid === "1"} />
        </>
      ) : (
        <CoachingAbout coached={coached} coaching={coaching} sessionsLeft={sessionsLeft} enquiries={enquiries} open={open} />
      )}
    </div>
  );
}

// The coaching tab: their coaching (once it's started), then what coaching is and how to enquire.
function CoachingAbout({
  coached,
  coaching,
  sessionsLeft,
  enquiries,
  open,
}: {
  coached: boolean;
  coaching: Awaited<ReturnType<typeof getMyCoaching>>;
  sessionsLeft: { available: number; href: string } | null;
  enquiries: Awaited<ReturnType<typeof getMyEnquiries>>;
  open: Awaited<ReturnType<typeof getMyEnquiries>>[number] | null;
}) {
  return (
    <>
      {coached ? <MemberCoaching data={coaching} sessionsLeft={sessionsLeft} /> : null}
      <h1 className="au-latest-h">{coached ? <>About <em>coaching</em></> : <>Work on it <em>together.</em></>}</h1>
      <p className="draft-tag">Draft</p>
      <p className="lead">
        Coaching here is led by you. You bring what matters; we work out the next step together. It builds on your
        audit and your plan, so we start from where you already are — not from scratch.
      </p>

      <GuideVideo clip={filmOrSoon(FILMS.C01, "coaching-intro", "Coaching with an Aligned Coach")} />

      <section className="coach-offer" aria-labelledby="focus-h">
        <div className="coach-offer-head">
          <div>
            <div className="eyebrow"><span className="eydot" /> {FOCUS.tagline}</div>
            <h2 id="focus-h">{FOCUS.name}</h2>
            <p>Six weeks with an Aligned Coach: three 60-minute sessions, agreed actions and a summary after each, with Practice and Momentum included throughout.</p>
          </div>
          <div className="coach-price">
            <span>Six weeks</span>
            <b>{FOCUS.price}</b>
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
