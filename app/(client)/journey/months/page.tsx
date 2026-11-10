import type { Metadata } from "next";
import Link from "next/link";
import { getBirthDate, getMonthReflections } from "@/lib/actions/life";
import { lifeGrid, yearRow, ymOf } from "@/lib/life-months";
import { localDate } from "@/lib/time";
import { LifeGrid } from "@/components/journey/LifeGrid";
import { ColourKey, YearStrip } from "@/components/journey/YearStrip";
import { BirthDateForm } from "@/components/journey/BirthDateForm";

export const metadata: Metadata = { title: "1,000 Months" };

// 1,000 Months, under More: optional, never a countdown. With a date of
// birth it draws their months a row per calendar year; without one it still
// shows this year, and invites them to add it.
export default async function MonthsPage() {
  const today = ymOf(localDate(new Date()));
  const year = Number(today.slice(0, 4));
  const [{ available, birthDate }, { months: reflections }] = await Promise.all([getBirthDate(), getMonthReflections()]);
  const birthYm = birthDate ? ymOf(birthDate) : null;

  return (
    <div className="page au-page lm-page">
      <div className="eyebrow"><span className="eydot" /> 1,000 Months</div>
      <h1 className="au-latest-h">Your life, <em>month by month.</em></h1>
      <p className="lead">
        A way to see where your time has gone and choose where it goes next. This month is highlighted; the months
        ahead are open. Choose any month that has begun to look back on it, and give it a colour if one fits.
      </p>

      {birthYm ? (
        <>
          <LifeGrid rows={lifeGrid(birthYm, today)} reflections={reflections} currentYear={year} />
          <ColourKey />
          <p className="au-small lm-foot">
            Months you haven&rsquo;t reflected on stay neutral. <Link href="/details#birth-date">Change your date of birth</Link>
          </p>
        </>
      ) : (
        <section className="pf-tile lm-start" aria-labelledby="lm-start-h">
          <h2 id="lm-start-h" className="pl-h">This year so far</h2>
          <YearStrip months={yearRow(year, today)} reflections={reflections} />
          <ColourKey />
          {available ? (
            <>
              <p className="pf-sub">To see every month of your life so far, add your date of birth. It&rsquo;s entirely optional.</p>
              <BirthDateForm initial={null} compact />
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
