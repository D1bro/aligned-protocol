import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { LEGAL, SITE } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Aligned, the free audit, your profile and coaching.",
  robots: LEGAL.approved ? { index: true, follow: true } : { index: false, follow: false },
};

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <h2>About these terms</h2>
      <p>
        These terms cover your use of Aligned (the-aligned.com): the free audit, your free profile and, if you work with
        Duane, coaching. Aligned is run by Duane Bryan <b>[to confirm: business name and legal status]</b>. By using the
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
        <li>You need to be 18 or over to create an account. <b>[to confirm]</b></li>
        <li>Keep your sign-in details to yourself; you&rsquo;re responsible for what happens under your account.</li>
        <li>The free audit and profile are free. We&rsquo;ll tell you clearly before anything costs money.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you write — answers, notes, plans and reflections — stays yours. You let us store and use it only to provide
        the service to you (and, if you work with Duane, to support your coaching). Please don&rsquo;t enter information
        about other people that they wouldn&rsquo;t want shared.
      </p>

      <h2>Coaching</h2>
      <ul>
        <li>Coaching is agreed separately with Duane: what&rsquo;s included, the price and the number of sessions.</li>
        <li>Invoices show what&rsquo;s owed and when it&rsquo;s due. You can pay by bank transfer, or by card where a card option is offered.</li>
        <li>Cancellations and missed sessions: <b>[to confirm: your notice period, and whether a late cancellation or no-show uses up a paid session]</b>.</li>
        <li>Refunds: <b>[to confirm: your refund policy]</b>. This doesn&rsquo;t affect your legal rights as a consumer.</li>
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
