"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, requestPasswordReset } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/Notice";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { BrandMark } from "@/components/ui/BrandMark";
import { ProfileOffer } from "@/components/site/ProfileOffer";
import { PROFILE_OFFER } from "@/lib/site-copy";

type Tab = "signin" | "signup" | "reset";

export function LoginForms({ hasSnapshot = false, startingPointSaved = false }: { hasSnapshot?: boolean; startingPointSaved?: boolean }) {
  const searchParams = useSearchParams();
  // Arriving here from "Create a free account to save this" on the audit
  // results page — jump straight to the signup tab instead of sign-in.
  const fromAudit = searchParams.get("signup") === "1" || hasSnapshot;
  const startOnSignup = searchParams.get("signup") === "1";
  // Arrived from an email confirmation link that couldn't sign them in
  // directly (e.g. opened on another device) — the email is confirmed.
  const confirmed = searchParams.get("confirmed") === "1";
  // An email link that had already been used or had run out (/auth/confirm).
  const expired = searchParams.get("link") === "expired";
  const [tab, setTab] = useState<Tab>(startOnSignup ? "signup" : "signin");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
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
    setOk("");
    startTransition(async () => {
      const res = await signUp(formData);
      if (!res.ok) setError(res.message);
      else setOk(res.message || "Check your email to confirm your account.");
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
        <BrandMark width={46} />
        <div className="auth-logo-brand">ALIGNED</div>
        <div className="auth-logo-sub">PROTOCOL</div>
      </div>

      {tab === "signin" && (
        <div className="card auth-card">
          <div className="auth-card-title">Welcome back</div>
          <p className="auth-card-sub">Sign in to your Aligned Protocol account.</p>
          {confirmed ? (
            <Notice type="ok">Your email is confirmed. Sign in to see your snapshot and starting point.</Notice>
          ) : null}
          {hasSnapshot ? (
            <Notice type="ok">Signing in adds the snapshot you&rsquo;ve just taken to your profile, alongside your earlier audits.</Notice>
          ) : null}
          {expired ? (
            <Notice type="err">That email link has already been used or has expired. Sign in below, or use &ldquo;Forgot password?&rdquo; to get a new link.</Notice>
          ) : null}
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
          {fromAudit ? (
            <>
              {startingPointSaved ? (
                <p className="auth-saved" role="status">✓ Your snapshot and starting point are saved on this device.</p>
              ) : null}
              <ProfileOffer showButton={false} headingLevel={2} />
            </>
          ) : (
            <>
              <div className="auth-card-title">Create your free profile</div>
              <p className="auth-card-sub">Start with the Aligned audit, then build your plan.</p>
            </>
          )}
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
              <input
                type="password"
                id="su-password"
                name="password"
                placeholder="Choose a strong password"
                required
                minLength={8}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />
              <PasswordStrength password={signupPassword} />
            </div>
            <button className="btn btn-p btn-block auth-submit" disabled={pending}>
              {pending ? "Creating your profile…" : PROFILE_OFFER.button}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
          <Notice type="ok">{ok}</Notice>
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
