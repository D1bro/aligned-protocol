import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { ClientNav } from "./ClientNav";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "coach" || profile.role === "admin") redirect("/coach");

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle="Protocol" />
        <ClientNav fullName={profile.full_name} />
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
