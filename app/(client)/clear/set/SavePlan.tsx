"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { planSaved, resendSaveEmail, saveGuestPlan } from "@/lib/actions/auth";

type Stage = { kind: "form" } | { kind: "check"; email: string } | { kind: "saved" };

// Save my plan: a short form in place, then "check your email" without
// leaving the plan. Notices when they've confirmed (here or on another
// device) and swaps to Go to my dashboard.
export function SavePlan({ firstReview }: { firstReview: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; exists?: boolean } | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  useEffect(() => {
    if (stage.kind !== "check") return;
    let stopped = false;
    const check = async () => {
      if (!stopped && (await planSaved())) setStage({ kind: "saved" });
    };
    const timer = window.setInterval(check, 6000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [stage.kind]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveGuestPlan(new FormData(e.currentTarget));
    setPending(false);
    if (!result.ok) return setError({ message: result.message, exists: result.exists });
    setStage(result.confirmed ? { kind: "saved" } : { kind: "check", email: result.email });
  }

  async function resend(to: string) {
    setResent(null);
    const r = await resendSaveEmail(to);
    setResent(r.ok ? "Sent again. It can take a minute to arrive." : r.message);
  }

  if (stage.kind === "saved") {
    return (
      <section className="ps-save is-saved" aria-live="polite">
        <h2>Your plan is saved.</h2>
        <p>Your first review is {firstReview}. We&rsquo;ll remind you by email.</p>
        <Link href="/?welcome=plan" className="btn btn-p">Go to my dashboard →</Link>
      </section>
    );
  }

  if (stage.kind === "check") {
    return (
      <section className="ps-save" aria-live="polite">
        <h2>Check your email to finish saving</h2>
        <p>
          We&rsquo;ve sent a link to <b>{stage.email}</b>. Open it on any device. Your plan is safe on this device until then.
        </p>
        <div className="ps-links">
          <button type="button" className="au-text-link as-btn" onClick={() => resend(stage.email)}>Resend the email</button>
          <button type="button" className="au-text-link as-btn" onClick={() => setStage({ kind: "form" })}>Wrong email? Change it</button>
        </div>
        {resent ? <p className="au-small" role="status">{resent}</p> : null}
      </section>
    );
  }

  return (
    <section className="ps-save" aria-labelledby="ps-save-h">
      <h2 id="ps-save-h">Save my plan</h2>
      <p>Create your free account so your plan, reviews and progress are here next time. No card needed.</p>
      <form onSubmit={submit} className="ps-form">
        <label>
          Your name
          <input name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name is fine" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
        </label>
        <button type="submit" className="btn btn-p" disabled={pending}>{pending ? "Saving…" : "Save my plan"}</button>
      </form>
      {error ? (
        <p className="clear-err" role="alert">
          {error.message} {error.exists ? <Link href="/login">Sign in</Link> : null}
        </p>
      ) : null}
      <p className="au-small">
        We&rsquo;ll send one email to confirm it&rsquo;s you. <Link href="/login">Already have an account? Sign in</Link> and this plan is added to it.
      </p>
    </section>
  );
}
