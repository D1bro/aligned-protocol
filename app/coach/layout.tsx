import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { CoachNav, CoachMobileNav } from "./CoachNav";

export const metadata: Metadata = { title: "Console", robots: { index: false, follow: false } };

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach" && profile.role !== "admin") redirect("/");

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle={profile.role === "admin" ? "Admin" : "Coach"} />
        <CoachNav fullName={profile.full_name} role={profile.role} />
      </aside>
      <CoachMobileNav fullName={profile.full_name} role={profile.role} />
      <div className="main">{children}</div>
    </div>
  );
}
