import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/session";
import { canUseJournal } from "@/lib/alignment";
import { getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { getJournal } from "@/lib/actions/journal";
import { getAllGoals, getReviews } from "@/lib/actions/checkins";
import { getMainGoal } from "@/lib/actions/goals";
import { getMonthIntention } from "@/lib/actions/planning";
import { planPrompts } from "@/lib/journal";
import { monthName, parseYm } from "@/lib/life-months";
import { localDate } from "@/lib/time";
import { getLifeAreas } from "@/lib/actions/audit";
import { getMyShares } from "@/lib/actions/coach-share";
import { getMyActionNames } from "@/lib/actions/daily";
import { JoinPractice } from "@/components/membership/JoinPractice";
import { JournalWorkspace } from "@/components/alignment/JournalWorkspace";

export const metadata: Metadata = { title: "Journal", robots: { index: false, follow: false } };

// The one journal, part of Aligned Practice and Momentum, in its own place
// in the menu (Duane, 10 Nov 2026). Write freely or in the section for one
// area of your chart (?area=); search by words or month (?q=, ?month=YYYY-MM,
// as month pages link here); filter by Next Step or daily action (?step=,
// ?action=); ?new=1 opens on a new entry, ?date= on a past day (the Daily
// Alignment's week links here for a note on an earlier day). After a membership
// ends, saved entries can still be read and exported here.
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; month?: string; new?: string; area?: string; step?: string; action?: string; date?: string }> }) {
  const { q, month: monthParam, new: startWriting, area, step: stepParam, action: actionParam, date: dateParam } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const month = parseYm(monthParam);
  const query = q?.trim().slice(0, 100) || "";
  const uuid = (x?: string) => (x && /^[0-9a-f-]{36}$/i.test(x) ? x : "");
  const step = uuid(stepParam);
  const action = uuid(actionParam);
  const today = localDate(new Date());
  const startDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : undefined;
  const filtered = !!(query || month || step || action);
  const [access, journal, goals, main, intention, areas, shares, actions] = await Promise.all([
    getMyAccess(),
    getJournal({ q: query, month: month ?? undefined, step, action, limit: 300 }),
    getAllGoals(),
    getMainGoal(),
    getMonthIntention(),
    getLifeAreas(),
    getMyShares(),
    getMyActionNames(),
  ]);
  const stepGoals = goals.filter((g) => g.status === "active" || g.id === step);
  const stepTitle = (id: string) => goals.find((g) => g.id === id)?.goal_title?.trim() || "a Next Step";
  const actionName = (id: string) => actions.find((a) => a.id === id)?.name ?? "a daily action";
  const canWrite = canUseJournal(profile.role, access.tier) && journal.available;
  const reviews = main?.goal ? await getReviews(main.goal.id) : null;
  const focus = reviews?.weekly.at(-1)?.next_commitment?.trim() || main?.goal?.goal_title?.trim() || null;

  return (
    <div className="page au-page journal-page">
      {canWrite ? (
        <>
          <div className="eyebrow"><span className="eydot" /> Journal</div>
          <h1 className="au-latest-h">Your <em>journal.</em></h1>
          <p className="lead">Private to you. Write freely, or in the section for one area of your life. Pick the day, write what&rsquo;s there, and save.</p>
        </>
      ) : (
        <JoinPractice open={await joiningOpen()} what="The journal" />
      )}

      {journal.available && (canWrite || journal.entries.length || filtered) ? (
        <form className="journal-search" method="get" role="search" aria-label="Search your journal">
          <label className="sr-only" htmlFor="journal-q">Words</label>
          <input id="journal-q" name="q" type="search" placeholder="Search your entries" defaultValue={query} />
          <label className="sr-only" htmlFor="journal-month">Month</label>
          <input id="journal-month" name="month" type="month" defaultValue={month ?? ""} max={today.slice(0, 7)} />
          {stepGoals.length ? (
            <>
              <label className="sr-only" htmlFor="journal-step">Next Step</label>
              <select id="journal-step" name="step" defaultValue={step}>
                <option value="">Any Next Step</option>
                {stepGoals.map((g) => <option key={g.id} value={g.id}>{g.goal_title?.trim() || "A Next Step"}</option>)}
              </select>
            </>
          ) : null}
          {actions.length ? (
            <>
              <label className="sr-only" htmlFor="journal-action">Daily action</label>
              <select id="journal-action" name="action" defaultValue={action}>
                <option value="">Any daily action</option>
                {actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          ) : null}
          <button type="submit" className="btn btn-g">Search</button>
          {filtered ? <Link href="/journal" className="au-text-link">Show all</Link> : null}
        </form>
      ) : null}
      {filtered ? (
        <p className="journal-filter" role="status">
          {journal.entries.length} {journal.entries.length === 1 ? "entry" : "entries"}
          {query ? <> with &ldquo;{query}&rdquo;</> : null}
          {month ? <> in {monthName(month)}</> : null}
          {step ? <> about {stepTitle(step)}</> : null}
          {action ? <> about {actionName(action)}</> : null}
          {month ? <> · <Link href={`/journey/months/${month}`}>Look back on {monthName(month).split(" ")[0]}</Link></> : null}
        </p>
      ) : null}

      {canWrite || journal.entries.length ? (
        <JournalWorkspace
          initial={journal.entries}
          today={today}
          startDate={startDate}
          actions={actions}
          shares={shares.hasCoach ? shares.bySource : null}
          canWrite={canWrite}
          userId={profile.id}
          goals={goals.filter((g) => g.status === "active" || journal.entries.some((e) => e.goal_id === g.id)).map((g) => ({ id: g.id, title: g.goal_title?.trim() || "A goal" }))}
          planPrompts={planPrompts({ focus, intention: intention.intention?.intention ?? null })}
          areas={areas.map((a) => ({ id: a.id, name: a.name, sort_order: a.sort_order }))}
          startArea={area}
          showEverySection={filtered}
          startWriting={startWriting === "1"}
        />
      ) : null}
    </div>
  );
}
