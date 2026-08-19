import Link from "next/link";

export const metadata = { title: "Reset password — Aligned" };

// Standalone landing for anyone who reaches /reset-password directly (e.g. a
// bookmarked link) rather than through the login page's "Forgot password?"
// tab — that tab is the normal way in, this is just a safety net.
export default function ResetPasswordPage() {
  return (
    <div className="center-page auth-bg">
      <div className="wrap">
        <div className="card auth-card">
          <div className="auth-card-title">Reset your password</div>
          <p className="auth-card-sub">
            Head back to the sign-in page and use &ldquo;Forgot password?&rdquo; to get a reset link sent to
            your email.
          </p>
          <Link href="/login" className="btn btn-p btn-block">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
