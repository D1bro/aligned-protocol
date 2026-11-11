import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDaily } from "@/lib/actions/daily";
import { getReviewDue } from "@/lib/actions/daily-review";
import { getMyShares } from "@/lib/actions/coach-share";
import { getMainGoal } from "@/lib/actions/goals";
import { getLifeAreas } from "@/lib/actions/audit";
import { getMyDetails } from "@/lib/actions/details";
import { getMyToday } from "@/lib/actions/next-step";
import { getCurrentProfile } from "@/lib/session";
import { greetingName } from "@/lib/details";
import { isSet, stepName } from "@/lib/next-step";
import { DailyView } from "@/components/daily/DailyView";
import { TodayActions } from "@/components/profile/TodayActions";

export const metadata: Metadata = { title: "Daily Alignment" };

// The Daily Alignment (Duane's build brief v1, 11 Nov 2026): an add-on to My
// Space, free in Aligned Clarity. Today: the focus, the Next Step's moves due
// today, their own daily actions (each linked to an area), the mindful
// timer and a quick check-in. Week: the evidence, without a score.
export default async function DailyPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const [daily, main, areas, details, today, review, shares] = await Promise.all([
    getDaily(),
    getMainGoal(),
    getLifeAreas(),
    getMyDetails(),
    getMyToday(null),
    getReviewDue(),
    getMyShares(),
  ]);
  const goals = main ? [main.goal, ...main.otherActive] : [];
  const firstName = greetingName({ preferred_name: details.preferred_name, full_name: profile.full_name });
  const zone = details.timezone || "Europe/London";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: safeZone(zone) }).format(new Date()));
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: safeZone(zone) }).format(new Date());

  const focusGoal = main && isSet(main.goal) ? main : null;
  const latest = focusGoal?.checkIns.at(-1)?.area_score ?? focusGoal?.baselineScore ?? null;
  const why = focusGoal?.goal.motivation_text?.trim() || focusGoal?.plan?.why_it_matters?.trim() || "";
  const steps = goals.filter((g) => isSet(g)).map((g) => ({ id: g.id, title: stepName(g) }));

  return (
    <div className="page au-page da-page">
      <div className="eyebrow"><span className="eydot" /> {dateLabel}</div>
      <h1 className="au-latest-h">{part}{firstName ? <>, <em>{firstName}.</em></> : "."} What matters today?</h1>

      {focusGoal?.area ? (
        <section className="da-focus" aria-label="Current focus">
          <div>
            <p className="da-k">Current focus · {focusGoal.area.name}</p>
            <p className="da-focus-step">{stepName(focusGoal.goal)}</p>
            {why ? <p className="da-why">Why it matters: <em>&ldquo;{why}&rdquo;</em></p> : null}
          </div>
          {latest !== null && focusGoal.target !== null ? (
            <p className="da-score">{latest}/10 now · aiming for {focusGoal.target}</p>
          ) : null}
        </section>
      ) : (
        <p className="da-focus da-focus-none">
          No Next Step set yet. <Link href="/next-step" className="au-text-link">Set your Next Step</Link> and its moves will show here too.
        </p>
      )}

      {!daily.available ? (
        <p className="clear-err" role="alert">The Daily Alignment isn&rsquo;t switched on yet. It needs database update 0034.</p>
      ) : (
        <DailyView
          data={daily}
          view={view === "week" ? "week" : "today"}
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          steps={steps}
          focusAreaId={focusGoal?.area?.id ?? null}
          review={review}
          hasCoach={shares.hasCoach}
          nextStep={
            today.moves.length ? (
              <TodayActions plan={null} moves={today.moves} own={[]} goals={[]} defaultGoalId={null} canAdd={false} />
            ) : null
          }
        />
      )}
    </div>
  );
}

function safeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return "Europe/London";
  }
}
