"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { planSaved, resendSaveEmail, saveGuestPlan } from "@/lib/actions/auth";

type Stage = { kind: "offer" } | { kind: "form" } | { kind: "check"; email: string } | { kind: "saved" };

const POINTS = ["Keep your Alignment Map and audit results", "Return and reassess whenever you choose", "Set goals and build on your starting point"];

function Tick() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="ss-tick">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity=".18" />
      <path d="M6 10.3l2.7 2.7L14.2 7.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Straight after the snapshot, for guests: the one clear next step. Saving
// turns the guest into a free account in place (lib/actions/auth.ts), so
// their map, scores and notes are already theirs; "Not now" goes on to the
// plan, and the guest bar keeps offering to save.
export function SaveStart({ skipHref = "#step-up" }: { skipHref?: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "offer" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; exists?: boolean } | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  // The guest bar's "Save your results" links to #save: open the form.
  useEffect(() => {
    const open = () => { if (window.location.hash === "#save") setStage((s) => (s.kind === "offer" ? { kind: "form" } : s)); };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

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

  return (
    <section id="save" className="ss" aria-labelledby="ss-h">
      {stage.kind === "saved" ? (
        <div className="ss-main" aria-live="polite">
          <p className="ss-k">Saved</p>
          <h2 id="ss-h" className="ss-h">Your starting point is <em>saved.</em></h2>
          <p className="ss-lead">Your Alignment Map is in your account, ready whenever you want it. Next: choose your first area to work on.</p>
          <div><Link href="/?welcome=saved" className="btn btn-p ss-btn">Go to my profile →</Link></div>
        </div>
      ) : stage.kind === "check" ? (
        <div className="ss-main" aria-live="polite">
          <p className="ss-k">One last step</p>
          <h2 id="ss-h" className="ss-h">Check your <em>email.</em></h2>
          <p className="ss-lead">
            We&rsquo;ve sent a link to <b>{stage.email}</b>. One click and your Alignment Map is saved. Open it on any device; your results stay safe on this one until then.
          </p>
          <div className="ss-links">
            <button type="button" className="au-text-link as-btn" onClick={() => resend(stage.email)}>Resend the email</button>
            <button type="button" className="au-text-link as-btn" onClick={() => setStage({ kind: "form" })}>Wrong email? Change it</button>
          </div>
          {resent ? <p className="au-small" role="status">{resent}</p> : null}
        </div>
      ) : stage.kind === "form" ? (
        <>
          <div className="ss-main">
            <p className="ss-k">Free account</p>
            <h2 id="ss-h" className="ss-h">Save your <em>Alignment Map.</em></h2>
            <p className="ss-lead">Your map, scores and notes move straight into your account. Nothing to redo.</p>
            <form onSubmit={submit} className="ss-form">
              <label>
                First name
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
              <button type="submit" className="btn btn-p ss-btn" disabled={pending}>{pending ? "Saving…" : "Save my Alignment Map"}</button>
            </form>
            {error ? (
              <p className="clear-err" role="alert">
                {error.message} {error.exists ? <Link href="/login">Sign in</Link> : null}
              </p>
            ) : null}
            <p className="ss-small">
              Free. No card, no subscription. By saving you agree to our <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
            </p>
            <p className="ss-small">Already have an account? <Link href="/login">Sign in</Link> and your results come with you.</p>
          </div>
          <aside className="ss-side" aria-labelledby="ss-next-h">
            <h3 id="ss-next-h">What happens next</h3>
            <ol>
              <li><span>1</span><p><b>We email you a link</b>So your account is yours, and only yours.</p></li>
              <li><span>2</span><p><b>One click, and it&rsquo;s saved</b>Your Alignment Map becomes your starting point.</p></li>
              <li><span>3</span><p><b>You choose where to start</b>Pick your first area and build one clear action for this week.</p></li>
            </ol>
          </aside>
        </>
      ) : (
        <>
          <div className="ss-main">
            <p className="ss-k">Your journey starts here</p>
            <h2 id="ss-h" className="ss-h">Make this your <em>starting point.</em></h2>
            <p className="ss-lead">This is where you are today. It doesn&rsquo;t have to be where you stay. Save your Alignment Map with a free account and start building towards the life you want.</p>
            <ul className="ss-points">{POINTS.map((p) => <li key={p}><Tick />{p}</li>)}</ul>
          </div>
          <div className="ss-act">
            <button type="button" className="btn btn-p ss-btn" onClick={() => setStage({ kind: "form" })}>Save my Alignment Map · Free</button>
            <p className="ss-small">Free account. No card, no subscription.</p>
            <p className="ss-small">Already have an account? <Link href="/login">Sign in</Link> and it comes with you.</p>
            <a href={skipHref} className="ss-skip">Not now, build my plan first</a>
          </div>
        </>
      )}
    </section>
  );
}
