import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { signOut } from "@/lib/actions/auth";
import { Logo } from "@/components/ui/Logo";

export default async function CoachPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach" && profile.role !== "admin") redirect("/");

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle="Coach" />
        <nav className="sb-nav">
          <div className="ni active"><span aria-hidden="true">▦</span> Overview</div>
          <form action={signOut} style={{ padding: "0 1.5rem", marginTop: "auto" }}>
            <button type="submit" className="ni" style={{ width: "100%", justifyContent: "flex-start" }}>
              <span aria-hidden="true">⏻</span> Sign out
            </button>
          </form>
        </nav>
      </aside>
      <div className="main">
        <div className="page">
          <div className="eyebrow"><span className="eydot" /> Coach dashboard</div>
          <h1>Not built yet — this is milestone 3</h1>
          <p className="lead">
            Welcome, {profile.full_name || profile.email}. The client roster, per-client detail, session
            notes and check-in review are next — porting the logic that already worked in coach.html onto
            this real schema, with every read/write happening through Server Actions instead of the
            browser, and Row-Level Security already in place to make sure you only ever see your own
            clients.
          </p>
        </div>
      </div>
    </div>
  );
}
