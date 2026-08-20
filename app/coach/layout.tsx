import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { CoachNav } from "./CoachNav";

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
      <div className="main">{children}</div>
    </div>
  );
}
