import { redirect } from "next/navigation";
import { getMainGoal } from "@/lib/actions/goals";
import { CheckInForm } from "./CheckInForm";

// The monthly goal check-in, on their main goal (the one My profile and My
// plan show).
export default async function CheckInPage() {
  const main = await getMainGoal();
  if (!main || !main.area || !main.goal.frequency?.trim() || !main.goal.success_criteria?.trim()) redirect("/clear");
  const { goal, plan, area, checkIns, baselineScore } = main;
  const auditScore = baselineScore ?? 0;
  const lastScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : auditScore;

  return (
    <CheckInForm
      goalId={goal.id}
      areaName={area.name}
      goalTitle={goal.action_text?.trim() || goal.goal_title?.trim() || ""}
      successCriteria={goal.success_criteria?.trim() ?? ""}
      lastScore={lastScore}
      target={main.target ?? Math.min(10, auditScore + 1)}
      ifThen={plan?.if_obstacle && plan?.if_response ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null}
    />
  );
}
