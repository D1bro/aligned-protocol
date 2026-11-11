import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { getLifeAreas } from "@/lib/actions/audit";
import { getWeeklyReview } from "@/lib/actions/daily-review";
import { WeeklyReview } from "@/components/daily/WeeklyReview";

export const metadata: Metadata = { title: "Weekly review", robots: { index: false, follow: false } };

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T12:00:00Z`));

// The weekly review (Daily Alignment, release 2): prepared from what was
// logged that week, then five questions. ?week= any day of an earlier week.
export default async function WeeklyReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const [data, areas] = await Promise.all([getWeeklyReview(week ?? null), getLifeAreas()]);
  const range = `${fmt(data.week, { day: "numeric", month: data.week.slice(5, 7) === data.weekEnd.slice(5, 7) ? undefined : "long" })}–${fmt(data.weekEnd, { day: "numeric", month: "long" })}`;

  return (
    <div className="page au-page da-page">
      <div className="eyebrow"><span className="eydot" /> Weekly review · {data.isThisWeek ? "this week" : range}</div>
      <h1 className="au-latest-h">How did <em>the week</em> go?</h1>
      <p className="lead">{range}. Prepared from what you logged, so there&rsquo;s nothing to add up. About three minutes; answer what&rsquo;s useful.</p>
      <nav className="da-weeknav" aria-label="Choose a week">
        <Link href={`/daily/review?week=${data.prevWeek}`} className="au-text-link">← Week before</Link>
        {data.nextWeek ? <Link href={`/daily/review?week=${data.nextWeek}`} className="au-text-link">Week after →</Link> : null}
        <Link href="/daily?view=week" className="au-text-link">Back to your week</Link>
      </nav>
      {data.available ? (
        <WeeklyReview data={data} areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
      ) : (
        <p className="clear-err" role="alert">The weekly review isn&rsquo;t switched on yet. It needs database update 0035.</p>
      )}
    </div>
  );
}
