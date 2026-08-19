"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "@/components/ui/Notice";

// The recovery link Supabase emails lands here with the session encoded in
// the URL fragment. The browser client picks that up automatically on load
// (detectSessionInUrl defaults to true) — this page just needs to let the
// person set a new password against that session.
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div className="center-page auth-bg">
      <div className="wrap">
        <div className="card auth-card">
          <div className="auth-card-title">Choose a new password</div>
          <p className="auth-card-sub">This link is single-use — set your new password below.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label className="lbl" htmlFor="new-password">New password</label>
              <input
                type="password"
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                minLength={8}
                required
              />
            </div>
            <button className="btn btn-p btn-block auth-submit" disabled={pending}>
              {pending ? "Saving…" : "Save new password"}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
        </div>
      </div>
    </div>
  );
}
