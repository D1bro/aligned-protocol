import type { Metadata } from "next";
import { getCoachProfile } from "@/lib/actions/coach-profile";
import { ProfileEditor } from "./ProfileEditor";

export const metadata: Metadata = { title: "My coaching profile" };

// The coach's own profile, private to them: how they work, and what they're
// working on. Every coaching reflection reads it before judging a session, so
// feedback respects their style and tracks their chosen learning areas.
export default async function CoachProfilePage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const [profile, { add }] = await Promise.all([getCoachProfile(), searchParams]);
  return (
    <div className="page admin-page cpf-page">
      <div className="eyebrow"><span className="eydot" /> Only you see this</div>
      <h1>My coaching profile</h1>
      <p className="lead">
        Your coaching reflections read this before they judge a session. They respect your style, challenge only what didn&rsquo;t
        serve the client or doesn&rsquo;t match what you intend, and check every session for the learning areas below.
      </p>
      {profile.available ? (
        <ProfileEditor initialApproach={profile.approach} initialAreas={profile.workingOn} suggested={add?.trim().slice(0, 400) ?? ""} />
      ) : (
        <p className="clear-err">This isn&rsquo;t switched on yet (it needs database update 0026).</p>
      )}
    </div>
  );
}
