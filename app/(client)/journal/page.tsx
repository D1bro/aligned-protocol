import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/session";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { getJournal } from "@/lib/actions/journal";
import { getAllGoals, getReviews } from "@/lib/actions/checkins";
import { getMainGoal } from "@/lib/actions/goals";
import { getMonthIntention } from "@/lib/actions/planning";
import { planPrompts } from "@/lib/journal";
import { monthName, parseYm } from "@/lib/life-months";
import { localDate } from "@/lib/time";
import { PracticeNav } from "@/components/membership/PracticeNav";
import { JoinPractice } from "@/components/membership/JoinPractice";
import { JournalWorkspace } from "@/components/alignment/JournalWorkspace";

export const metadata: Metadata = { title: "Journal", robots: { index: false, follow: false } };

// The one journal, part of Aligned Practice and Momentum. Search by words or
// month (?q=, ?month=YYYY-MM, as month pages link here); ?new=1 opens on a new
// entry. After a membership ends, saved entries can still be read and
// exported here.
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; month?: string; new?: string }> }) {
  const { q, month: monthParam, new: startWriting } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const month = parseYm(monthParam);
  const query = q?.trim().slice(0, 100) || "";
  const filtered = !!(query || month);
  const [access, journal, goals, main, intention] = await Promise.all([
    getMyAccess(),
    getJournal({ q: query, month: month ?? undefined, limit: filtered ? 200 : 60 }),
    getAllGoals(),
    getMainGoal(),
    getMonthIntention(),
  ]);
  const canWrite = canUseDailyAlignment(profile.role, access.tier) && journal.available;
  const reviews = main?.goal ? await getReviews(main.goal.id) : null;
  const focus = reviews?.weekly.at(-1)?.next_commitment?.trim() || main?.goal?.goal_title?.trim() || null;

  return (
    <div className="page au-page journal-page">
      <PracticeNav on="journal" />
      {canWrite ? (
        <>
          <div className="eyebrow"><span className="eydot" /> Journal</div>
          <h1 className="au-latest-h">Your journal</h1>
          <p className="lead">Private to you. Write a line or a page, with a prompt or without. Add a photo or a video link if it helps you remember.</p>
        </>
      ) : (
        <JoinPractice open={await joiningOpen()} what="The journal" />
      )}

      {journal.available && (canWrite || journal.entries.length || filtered) ? (
        <form className="journal-search" method="get" role="search" aria-label="Search your journal">
          <label className="sr-only" htmlFor="journal-q">Words</label>
          <input id="journal-q" name="q" type="search" placeholder="Search your entries" defaultValue={query} />
          <label className="sr-only" htmlFor="journal-month">Month</label>
          <input id="journal-month" name="month" type="month" defaultValue={month ?? ""} max={localDate(new Date()).slice(0, 7)} />
          <button type="submit" className="btn btn-g">Search</button>
          {filtered ? <Link href="/journal" className="au-text-link">Show all</Link> : null}
        </form>
      ) : null}
      {filtered ? (
        <p className="journal-filter" role="status">
          {journal.entries.length} {journal.entries.length === 1 ? "entry" : "entries"}
          {query ? <> with &ldquo;{query}&rdquo;</> : null}
          {month ? <> in {monthName(month)}</> : null}
          {month ? <> · <Link href={`/journey/months/${month}`}>See {monthName(month).split(" ")[0]} in My Journey</Link></> : null}
        </p>
      ) : null}

      {canWrite || journal.entries.length ? (
        <JournalWorkspace
          initial={journal.entries}
          today={localDate(new Date())}
          canWrite={canWrite}
          userId={profile.id}
          goals={goals.filter((g) => g.status === "active" || journal.entries.some((e) => e.goal_id === g.id)).map((g) => ({ id: g.id, title: g.goal_title?.trim() || "A goal" }))}
          planPrompts={planPrompts({ focus, intention: intention.intention?.intention ?? null })}
          startWriting={startWriting === "1"}
        />
      ) : null}
    </div>
  );
}
