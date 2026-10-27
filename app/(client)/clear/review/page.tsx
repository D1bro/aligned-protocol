import { redirect } from "next/navigation";
import { getMainGoal } from "@/lib/actions/goals";
import { getReviews } from "@/lib/actions/checkins";
import { nextReview } from "@/lib/review-schedule";
import { fallbackOf } from "@/lib/plan-action";
import { WeeklyReviewForm } from "./WeeklyReviewForm";
import { CheckInForm } from "../check-in/CheckInForm";

const filled = (v: string | null | undefined) => !!v?.trim();

// The review that's next on their main goal: the weekly review, or every
// fourth week the monthly review (which scores the area again). Doing it
// early is fine; the next one is then counted from today.
export default async function ReviewPage() {
  const main = await getMainGoal();
  if (!main || !main.area || !filled(main.goal.frequency) || !filled(main.goal.success_criteria)) redirect("/clear");
  const { goal, plan, area, checkIns, baselineScore } = main;
  const reviews = await getReviews(goal.id);
  const next = nextReview({ start: goal.created_at ?? new Date().toISOString(), actionWhen: goal.action_when, reviews: reviews.all });

  if (next.kind === "monthly") {
    const auditScore = baselineScore ?? 0;
    return (
      <CheckInForm
        goalId={goal.id}
        areaName={area.name}
        goalTitle={goal.goal_title?.trim() || goal.action_text?.trim() || ""}
        successCriteria={goal.success_criteria?.trim() ?? ""}
        lastScore={checkIns.length ? checkIns[checkIns.length - 1].area_score : auditScore}
        target={main.target ?? Math.min(10, auditScore + 1)}
        ifThen={plan?.if_obstacle && plan?.if_response ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null}
      />
    );
  }

  const last = reviews.weekly.at(-1);
  const intended = last?.next_commitment?.trim() || goal.goal_title?.trim() || goal.action_text?.trim() || "";
  const when = goal.action_when?.trim() ?? "";
  const fallback = fallbackOf(plan);
  const smaller = fallback ? `${when ? `${when}, ` : ""}I’ll ${fallback.charAt(0).toLowerCase()}${fallback.slice(1).replace(/[.\s]+$/, "")}.` : "";

  return <WeeklyReviewForm goalId={goal.id} areaName={area.name} week={next.number} intended={intended} smaller={smaller} />;
}
