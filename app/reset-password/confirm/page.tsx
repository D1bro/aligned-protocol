"use client";

import { use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "@/components/ui/Notice";

// The recovery link Supabase emails lands here with the session encoded in
// the URL fragment. The browser client picks that up automatically on load
// (detectSessionInUrl defaults to true) — this page just needs to let the
// person set a new password against that session. Invitations land here too
// (?welcome=1), so a new client chooses their first password.
export default function ResetPasswordConfirmPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const welcome = use(searchParams).welcome === "1";
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
      router.push(welcome ? "/audit" : "/");
    });
  }

  return (
    <div className="center-page auth-bg">
      <div className="wrap">
        <div className="card auth-card">
          <div className="auth-card-title">{welcome ? "Welcome to the Aligned Protocol" : "Choose a new password"}</div>
          <p className="auth-card-sub">
            {welcome
              ? "Choose a password for your account. Next, you’ll take the Aligned Audit — about ten minutes."
              : "This link is single-use — set your new password below."}
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label className="lbl" htmlFor="new-password">{welcome ? "Your password" : "New password"}</label>
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
              {pending ? "Saving…" : welcome ? "Save and continue" : "Save new password"}
            </button>
          </form>
          <Notice type="err">{error}</Notice>
        </div>
      </div>
    </div>
  );
}
