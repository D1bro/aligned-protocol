import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { MobileNav, type MobileNavLink } from "@/components/ui/MobileNav";
import { CoachNav } from "./CoachNav";

const COACH_LINKS: MobileNavLink[] = [
  { href: "/coach", label: "Client Roster", icon: "▦", match: (p) => p === "/coach" || p.startsWith("/coach/clients") },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach" && profile.role !== "admin") redirect("/");

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle="Coach" />
        <CoachNav fullName={profile.full_name} />
      </aside>
      <MobileNav links={COACH_LINKS} fullName={profile.full_name} />
      <div className="main">{children}</div>
    </div>
  );
}
