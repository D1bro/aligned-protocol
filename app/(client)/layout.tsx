import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { MobileNav } from "@/components/ui/MobileNav";
import { ClientNav, CLIENT_LINKS } from "./ClientNav";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "coach" || profile.role === "admin") redirect("/");

  if (profile.isAnonymous) {
    // Guests taking the audit before creating an account can only ever land
    // on /audit routes (middleware enforces this) — those pages already
    // have their own back button and progress bar, so skip the full app
    // chrome entirely rather than exposing Dashboard/CLEAR/Goals links and a
    // "Sign out" button that would silently abandon their in-progress audit.
    // The thin bar below is the only nav they get — mainly so a returning
    // client who lands here by mistake (or just wants to check) has an
    // obvious way to sign in instead of being stuck taking the audit again.
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle="Protocol" />
        <ClientNav fullName={profile.full_name} />
      </aside>
      <MobileNav links={CLIENT_LINKS} fullName={profile.full_name} />
      <div className="main">{children}</div>
    </div>
  );
}
