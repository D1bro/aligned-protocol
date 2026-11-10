import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthReflections, getMonthStory } from "@/lib/actions/life";
import { addMonths, monthName, parseYm, ymOf } from "@/lib/life-months";
import { localDate } from "@/lib/time";
import { formatDate } from "@/lib/audit-schedule";
import { canUseJournal } from "@/lib/alignment";
import { getMyAccess } from "@/lib/actions/membership";
import { getCurrentProfile } from "@/lib/session";
import { MonthReflectionForm } from "@/components/journey/MonthReflectionForm";

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const ym = parseYm((await params).month);
  return { title: ym ? monthName(ym) : "Month" };
}

const day = (ymd: string) => new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// One month: their reflection on it (a colour they choose, a few words) and
// what happened in it, from what they've already saved. Months that haven't
// begun can't be reflected on.
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const ym = parseYm((await params).month);
  const today = ymOf(localDate(new Date()));
  if (!ym || ym > today) notFound();
  const [story, { available, months }, profile, access] = await Promise.all([getMonthStory(ym), getMonthReflections(), getCurrentProfile(), getMyAccess()]);
  const reflection = months[ym] ?? null;
  const journalOn = canUseJournal(profile?.role, access.tier);
  const prev = addMonths(ym, -1);
  const next = addMonths(ym, 1);

  const happened = story
    ? [
        story.intention ? { k: "Intention", v: story.intention, serif: true } : null,
        story.actions.total ? { k: "Actions", v: `${story.actions.done} of ${story.actions.total} done` } : null,
        story.weeklyReviews ? { k: "Weekly check-ins", v: String(story.weeklyReviews) } : null,
        story.monthlyReviews ? { k: "Monthly reviews", v: String(story.monthlyReviews) } : null,
        ...story.audits.map((a) => ({ k: "Audit", v: `${formatDate(a.date)}${a.score !== null ? ` · whole-life ${a.score}/100` : ""}` })),
        ...story.goalsSet.map((g) => ({ k: "Next Step set", v: g })),
        ...story.goalsDone.map((g) => ({ k: "Next Step taken", v: g })),
      ].filter((x): x is { k: string; v: string; serif?: boolean } => !!x)
    : [];

  return (
    <div className="page au-page lm-page">
      <nav className="lm-monthnav" aria-label="Months">
        <Link href={`/journey/months/${prev}`} className="au-text-link">← {monthName(prev, "short")}</Link>
        <Link href="/journey/months" className="au-text-link">1,000 Months</Link>
        {next <= today ? <Link href={`/journey/months/${next}`} className="au-text-link">{monthName(next, "short")} →</Link> : <span />}
      </nav>
      <div className="eyebrow"><span className="eydot" /> {ym === today ? "This month" : "Looking back"}</div>
      <h1 className="au-latest-h">{monthName(ym)}</h1>

      {available ? (
        <section className="pf-tile lm-section" aria-labelledby="lm-reflect-h">
          <h2 id="lm-reflect-h" className="pl-h">{ym === today ? "How is this month going?" : "How would you describe this month?"}</h2>
          <MonthReflectionForm month={ym} initialColour={reflection?.colour ?? null} initialReflection={reflection?.reflection ?? null} saved={!!reflection} />
        </section>
      ) : null}

      <section className="pf-tile lm-section" aria-labelledby="lm-happened-h">
        <h2 id="lm-happened-h" className="pl-h">What happened</h2>
        {happened.length ? (
          <dl className="lm-story">
            {happened.map((h, i) => (
              <div key={i}><dt>{h.k}</dt><dd className={h.serif ? "lm-serif" : undefined}>{h.v}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="pf-sub">Nothing saved in The Aligned for this month. That&rsquo;s fine: your reflection is enough.</p>
        )}
      </section>

      {journalOn && story?.journal.available ? (
        <section className="pf-tile lm-section" aria-labelledby="lm-journal-h">
          <h2 id="lm-journal-h" className="pl-h">From your journal</h2>
          {story.journal.entries.length ? (
            <ul className="lm-journal">
              {story.journal.entries.map((e) => (
                <li key={e.id}><span>{day(e.date)}</span><p>{e.opening}</p></li>
              ))}
            </ul>
          ) : (
            <p className="pf-sub">No entries this month.</p>
          )}
          <Link href={`/journal?month=${ym}`} className="au-text-link">{story.journal.entries.length ? `All of ${monthName(ym).split(" ")[0]} in my journal →` : "Open my journal →"}</Link>
        </section>
      ) : null}
    </div>
  );
}
