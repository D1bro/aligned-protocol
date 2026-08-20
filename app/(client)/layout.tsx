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
    return (
      <div className="shell">
        <div className="main no-sidebar">{children}</div>
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
