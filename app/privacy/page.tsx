import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { LEGAL, SITE } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Aligned collects, uses and protects your information.",
  robots: LEGAL.approved ? { index: true, follow: true } : { index: false, follow: false },
};

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

// Written to match what the system actually does (see the code and
// migrations). Keep it in step when features change.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <h2>Who we are</h2>
      <p>
        Aligned (the-aligned.com) is run by Duane Bryan <b>[to confirm: business name and legal status, e.g. sole trader or
        company and number]</b>, <b>[to confirm: postal address]</b>. We are the &ldquo;controller&rdquo; of your personal
        information. ICO registration number: <b>[to confirm]</b>. Contact us about anything in this policy at {mail}.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Your audit answers, notes and plans are yours. We use them to give you the service, nothing else.</li>
        <li>We never sell your information or use it for advertising.</li>
        <li>Some of what you write can be sensitive (for example about health or emotions). We only keep it because you choose to enter it, and you can ask us to delete it at any time.</li>
        <li>If you work with Duane as your coach, Duane can see your audit, plan and what you choose to share — not your private reflections or private preparation.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li><b>If you take the audit without an account:</b> a temporary guest sign-in stored in your browser, and the scores and notes you enter.</li>
        <li><b>Your account:</b> your name and email address, and a password (stored securely by our sign-in provider; we never see it).</li>
        <li><b>Your audit, plan and progress:</b> scores, notes, your chosen focus, your CLEAR plan, goals, check-ins, lesson progress and reflections (which you can keep private).</li>
        <li><b>Daily Alignment (optional):</b> only what you choose to save — your daily priority, value, act of care, reflections, four optional answers and weekly reviews. These are private to you: your coach can&rsquo;t see them. You can export or delete them yourself at any time.</li>
        <li><b>Your details (optional):</b> preferred name, phone number, town or city, country and time zone.</li>
        <li><b>Coaching (if you work with Duane):</b> session dates and times, Duane&rsquo;s private notes, conversation transcripts (only with your agreement), session summaries, agreed actions, your updates and anything you choose to share before a session.</li>
        <li><b>Billing (if you pay for coaching):</b> billing name and postal address, invoices, payments, credit notes and refunds. Card payments are handled by Stripe; we never see or store your card number.</li>
        <li><b>Emails:</b> a record of the emails we send you (for example invoices, session summaries and reminders) and whether you&rsquo;ve turned reminders off.</li>
        <li><b>Coaching enquiries:</b> what you tell us when you ask about coaching.</li>
        <li><b>Site use:</b> anonymous visit counts (no cookies, nothing that identifies you) and standard security logs.</li>
      </ul>

      <h2>Why we use it, and on what basis</h2>
      <ul>
        <li><b>To provide the service you ask for</b> — your snapshot, profile, plan, check-ins and coaching (contract).</li>
        <li><b>Sensitive information you choose to enter</b> — some answers may reveal information about your health or emotional wellbeing. We only process this with your explicit consent, which you give by entering it, and which you can withdraw by asking us to delete it.</li>
        <li><b>Transcripts</b> are only added when you&rsquo;ve agreed to the conversation being recorded or transcribed (consent).</li>
        <li><b>Invoices and payment records</b> — we must keep these for tax purposes (legal obligation).</li>
        <li><b>Service emails</b> — sign-in links, invoices, session summaries and reminders you&rsquo;ve set up (contract and legitimate interests). Reminders can be switched off from any reminder email or your plan.</li>
        <li><b>Keeping the service secure and working</b> (legitimate interests).</li>
      </ul>

      <h2>Who else handles it</h2>
      <p>We use a small number of trusted providers, who only process your information on our instructions:</p>
      <ul>
        <li><b>Supabase</b> — our database and sign-in, hosted in London.</li>
        <li><b>Vercel</b> — hosts the website and counts anonymous visits.</li>
        <li><b>Resend</b> — sends our emails.</li>
        <li><b>Stripe</b> — takes card payments.</li>
      </ul>
      <p>
        Some of these providers are based in, or may access information from, the United States. Where that happens the
        transfer is protected by the UK&rsquo;s approved safeguards (such as the UK–US data bridge or standard contractual
        clauses). <b>[to confirm with each provider&rsquo;s data processing terms]</b>
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>We periodically remove guest sign-ins that were never used, and unfinished guest audits that have been inactive for a while.</li>
        <li>Your account and everything in it is kept until you ask us to delete it.</li>
        <li>Invoices and payment records are kept for six years, as the law requires, even if the rest of your account is deleted.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We only use cookies that are needed for the site to work: they keep you signed in (or keep your guest audit
        together). We don&rsquo;t use advertising or tracking cookies, and our visit counts don&rsquo;t use cookies at all.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, download or delete your information, to restrict or object to how we use it, and to
        withdraw your consent at any time. You can update most details yourself on your Your details page. For anything
        else, email {mail} and we&rsquo;ll reply within one month.
      </p>
      <p>
        If you&rsquo;re unhappy with how we&rsquo;ve handled your information, please tell us first. You also have the right to
        complain to the Information Commissioner&rsquo;s Office (ico.org.uk).
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&rsquo;ll update the date above and tell members by email.</p>
    </LegalPage>
  );
}
