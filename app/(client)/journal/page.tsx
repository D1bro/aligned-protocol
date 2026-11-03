import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/session";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { getJournal } from "@/lib/actions/journal";
import { localDate } from "@/lib/time";
import { PracticeNav } from "@/components/membership/PracticeNav";
import { JoinPractice } from "@/components/membership/JoinPractice";
import { JournalWorkspace } from "@/components/alignment/JournalWorkspace";

export const metadata: Metadata = { title: "Journal", robots: { index: false, follow: false } };

// The private journal, part of Aligned Practice and Momentum. After a
// membership ends, saved entries can still be read and exported here.
export default async function JournalPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const [access, journal] = await Promise.all([getMyAccess(), getJournal()]);
  const canWrite = canUseDailyAlignment(profile.role, access.tier) && journal.available;
  return (
    <div className="page au-page journal-page">
      <PracticeNav on="journal" />
      {canWrite ? (
        <>
          <div className="eyebrow"><span className="eydot" /> Journal</div>
          <h1 className="au-latest-h">Your journal</h1>
          <p className="lead">Private to you. Write a line or a page, with a prompt or without.</p>
        </>
      ) : (
        <JoinPractice open={await joiningOpen()} what="The journal" />
      )}
      {canWrite || journal.entries.length ? <JournalWorkspace initial={journal.entries} today={localDate(new Date())} canWrite={canWrite} /> : null}
    </div>
  );
}
