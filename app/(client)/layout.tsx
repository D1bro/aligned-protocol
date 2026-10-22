import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { ClientNav, ClientMobileNav } from "./ClientNav";

// Member pages are personal: keep them out of search results. The audit
// welcome page opts back in (app/(client)/audit/page.tsx).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  // No sign-in at all: only the audit welcome page gets here (middleware sends
  // every other member page to /login), so show it with the guest bar.
  if (!profile) return <GuestShell>{children}</GuestShell>;
  // Coaches and admins can use the member pages too (they land in /coach
  // after signing in). Redirecting them to "/" here looped forever.
  const staff = profile.role === "coach" || profile.role === "admin";

  if (profile.isAnonymous) {
    // Guests taking the audit before creating an account can only ever land
    // on /audit routes (middleware enforces this) — those pages already
    // have their own back button and progress bar, so skip the full app
    // chrome entirely rather than exposing Dashboard/CLEAR/Goals links and a
    // "Sign out" button that would silently abandon their in-progress audit.
    // The thin bar below is the only nav they get — mainly so a returning
    // client who lands here by mistake (or just wants to check) has an
    // obvious way to sign in instead of being stuck taking the audit again.
    return <GuestShell>{children}</GuestShell>;
  }

  return (
    <div className="shell has-tabs">
      <aside className="sidebar">
        <Logo subtitle="Protocol" />
        <ClientNav fullName={profile.full_name} staff={staff} />
      </aside>
      <ClientMobileNav fullName={profile.full_name} staff={staff} />
      <div className="main">{children}</div>
    </div>
  );
}

function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <div className="main no-sidebar">
        <div className="guest-bar">
          <span>Taking the Aligned Audit as a guest</span>
          <Link href="/login" className="guest-bar-link">Already have an account? Sign in</Link>
        </div>
        {children}
      </div>
    </div>
  );
}
