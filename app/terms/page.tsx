import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { LEGAL, SITE } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Aligned: the free audit and profile, memberships and coaching.",
  robots: LEGAL.approved ? { index: true, follow: true } : { index: false, follow: false },
};

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <h2>About these terms</h2>
      <p>
        These terms cover your use of Aligned (the-aligned.com): the free audit and profile, the Aligned Practice and
        Aligned Momentum memberships, and coaching. Aligned is run by Aligned Media Ltd, a company registered in England
        and Wales (company number 17117977), registered office 369 Grimshaw Lane, Middleton, Manchester, M24 1GQ
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using the
        site you agree to these terms and to our <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Not medical or psychological treatment</h2>
      <p>
        The audit, plans and coaching are for personal development. They are not therapy, counselling, or medical,
        psychological or financial advice, and scores are your own reflection, not a diagnosis. If you&rsquo;re struggling or
        in crisis, please get help now: call 999 in an emergency, NHS 111 for urgent health advice, or Samaritans free on
        116 123, any time.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You need to be 18 or over to create an account.</li>
        <li>Keep your sign-in details to yourself; you&rsquo;re responsible for what happens under your account.</li>
        <li>The free audit and profile are free. We&rsquo;ll tell you clearly before anything costs money.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you write — answers, notes, plans and reflections — stays yours. You let us store and use it only to provide
        the service to you (and, if you work with Duane, to support your coaching). Please don&rsquo;t enter information
        about other people that they wouldn&rsquo;t want shared.
      </p>

      <h2>Memberships: Aligned Practice and Aligned Momentum</h2>
      <ul>
        <li>Aligned Practice is £9 a month and Aligned Momentum is £25 a month. The price shown when you join is what you pay each month.</li>
        <li>You pay by card through Stripe, monthly in advance from the day you join. Your membership renews automatically each month until you cancel.</li>
        <li>Founding prices: if you join at a founding price, you keep it for as long as your membership continues. If you cancel and rejoin later, the price at that time applies.</li>
        <li>You can cancel at any time on your My membership page. You keep everything until the end of the month you&rsquo;ve paid for, and you won&rsquo;t be charged again. Apart from the 14 days below, months already paid aren&rsquo;t refunded.</li>
        <li>Changing your mind: you can cancel within 14 days of first joining and we&rsquo;ll refund your first payment in full. Email {mail}.</li>
        <li>Moving between Practice and Momentum takes effect straight away; your next payment is adjusted for the rest of that month.</li>
        <li>If a payment fails, Stripe will try again over the following days and your membership carries on meanwhile. If the payment still can&rsquo;t be taken, the membership ends.</li>
        <li>If we change the price for existing members, we&rsquo;ll email you at least 30 days before it applies, and you can cancel before then. Founding prices don&rsquo;t change while your membership continues.</li>
        <li>Momentum&rsquo;s weekly live session is on Zoom at the time shown on your dashboard. Now and then a session may move or be cancelled; we&rsquo;ll tell you in advance wherever we can. Please keep what others share in the session to yourself.</li>
        <li>When a membership ends, your account, plan and reviews stay yours, and you can still export or delete your journal. Members-only features close until you rejoin.</li>
      </ul>

      <h2>Coaching and Aligned Focus</h2>
      <ul>
        <li>Coaching is with an Aligned Coach. Each package or invoice shows what&rsquo;s included, the price and the number of sessions.</li>
        <li>Aligned Focus is £995, paid in one go, for a six-week programme: three 60-minute one-to-one sessions with an Aligned Coach, with Aligned Momentum included for the six weeks. Sessions are to be used within 42 days of payment.</li>
        <li>Invoices show what&rsquo;s owed and when it&rsquo;s due. You can pay by bank transfer, or by card where a card option is offered.</li>
        <li>Cancelling or moving a session: you can rearrange free of charge with at least 48 hours&rsquo; notice. A later cancellation, or not turning up, uses up that session.</li>
        <li>Refunds: if you change your mind within 14 days of paying for coaching or Aligned Focus, email {mail} and we&rsquo;ll refund you in full, less the price of any sessions you&rsquo;ve already had. After 14 days, unused sessions aren&rsquo;t refunded. This doesn&rsquo;t affect your legal rights as a consumer.</li>
      </ul>

      <h2>Fair use</h2>
      <p>
        Please don&rsquo;t misuse the site: no attempts to access other people&rsquo;s information, interfere with the service,
        or copy its content for commercial use. We may suspend accounts that do.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using Aligned at any time and ask us to delete your account by emailing {mail}. We may close accounts
        that break these terms. Invoices and payment records are kept as the law requires.
      </p>

      <h2>Our responsibility</h2>
      <p>
        We work hard to keep the service available and accurate, but we can&rsquo;t promise it will always be uninterrupted.
        Nothing in these terms limits our liability where the law doesn&rsquo;t allow it to be limited, or affects your
        statutory rights.
      </p>

      <h2>Changes and law</h2>
      <p>
        We may update these terms; if a change matters, we&rsquo;ll tell members by email. These terms are governed by the
        law of England and Wales. Questions: {mail}.
      </p>
    </LegalPage>
  );
}
