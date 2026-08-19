"use client";

import { useState, useTransition } from "react";
import { signIn, signUp, requestPasswordReset } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/Notice";

type Tab = "signin" | "signup" | "reset";

export function LoginForms() {
  const [tab, setTab] = useState<Tab>("signin");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, startTransition] = useTransition();

  function go(t: Tab) {
    setError("");
    setOk("");
    setTab(t);
  }

  function handleSignIn(formData: FormData) {
    setError("");
    startTransition(async () => {
      const res = await signIn(formData);
      // A successful signIn redirects server-side and never returns here.
      if (!res.ok) setError(res.message);
    });
  }

  function handleSignUp(formData: FormData) {
    setError("");
    startTransition(async () => {
      const res = await signUp(formData);
      if (!res.ok) setError(res.message);
    });
  }

  function handleReset(formData: FormData) {
    setError("");
    setOk("");
    startTransition(async () => {
      const res = await requestPasswordReset(formData);
      if (!res.ok) setError(res.message);
      else setOk("Check your email for a reset link.");
    });
  }

  return (
    <div className="wrap">
      <div className="auth-logo">
        <svg width="44" height="41" viewBox="0 0 44 41" fill="none" aria-hidden="true">
          <path d="M22 2 L42 39" stroke="#E0B140" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M22 2 L2 39" stroke="#E0B140" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="22" cy="29" r="4.5" fill="#E0B140" />
        </svg>
        <div className="auth-logo-brand">ALIGNED</div>
        <div className="auth-logo-sub">PROTOCOL</div>
      </div>

      {tab === "signin" && (
        <div className="card auth-card">
          <div className="auth-card-title">Welcome back</div>
          <p className="auth-card-sub">Sign in to your Aligned Protocol account.</p>
          <form action={handleSignIn}>
            <div className="field">
              <label className="lbl" htmlFor="email">Email</label>
              <input type="email" id="email" name="email" placeholder="your@email.com" autoComplete="email" required />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="password">Password</label>
              <input type="password" id="password" name="password" placeholder="Your password" autoComplete="current-password" required />
            </div>
            <button className="btn btn-p btn-block auth-submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
          <div className="div" />
          <div className="auth-footer">
            Don&apos;t have an account? <button type="button" className="auth-link" onClick={() => go("signup")}>Create one</button>
            <br />
            <button type="button" className="auth-link auth-link-sm" onClick={() => go("reset")}>Forgot password?</button>
          </div>
        </div>
      )}

      {tab === "signup" && (
        <div className="card auth-card">
          <div className="auth-card-title">Create your account</div>
          <p className="auth-card-sub">Join The Aligned Protocol and start your journey.</p>
          <form action={handleSignUp}>
            <div className="field">
              <label className="lbl" htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" placeholder="Your full name" required />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="su-email">Email</label>
              <input type="email" id="su-email" name="email" placeholder="your@email.com" required />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="su-password">Password</label>
              <input type="password" id="su-password" name="password" placeholder="Choose a strong password" required minLength={8} />
            </div>
            <button className="btn btn-p btn-block auth-submit" disabled={pending}>
              {pending ? "Creating account…" : "Create Account"}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
          <div className="div" />
          <div className="auth-footer">
            Already have an account? <button type="button" className="auth-link" onClick={() => go("signin")}>Sign in</button>
          </div>
        </div>
      )}

      {tab === "reset" && (
        <div className="card auth-card">
          <div className="auth-card-title">Reset password</div>
          <p className="auth-card-sub">Enter your email and we&apos;ll send a reset link.</p>
          <form action={handleReset}>
            <div className="field">
              <label className="lbl" htmlFor="reset-email">Email</label>
              <input type="email" id="reset-email" name="email" placeholder="your@email.com" required />
            </div>
            <button className="btn btn-p btn-block auth-submit" disabled={pending}>
              {pending ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
          <Notice type="ok">{ok}</Notice>
          <div className="auth-footer" style={{ marginTop: "1rem" }}>
            <button type="button" className="auth-link" onClick={() => go("signin")}>← Back to sign in</button>
          </div>
        </div>
      )}
    </div>
  );
}
