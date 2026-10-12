import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getLifeAreas, getAuditWithResponses } from "@/lib/actions/audit";
import { getPlanState } from "@/lib/actions/clear";
import { getCheckIns } from "@/lib/actions/checkins";
import { CheckInForm } from "./CheckInForm";

// The monthly check-in on their current goal.
export default async function CheckInPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");
  const { plan, goal, stage } = await getPlanState(audit.id);
  if (!plan || !goal || stage !== "done" || goal.status !== "active") redirect("/clear");

  const [areas, { responses }, checkIns] = await Promise.all([
    getLifeAreas(),
    getAuditWithResponses(audit.id),
    getCheckIns(goal.id),
  ]);
  const area = areas.find((a) => a.id === plan.life_area_id);
  if (!area) redirect("/clear");
  const auditScore = (responses.find((r) => r.life_area_id === area.id)?.satisfaction_score as number | undefined) ?? 0;
  const lastScore = checkIns.length ? checkIns[checkIns.length - 1].area_score : auditScore;

  return (
    <CheckInForm
      goalId={goal.id}
      areaName={area.name}
      goalTitle={goal.goal_title?.trim() ?? ""}
      lastScore={lastScore}
      target={Math.min(10, plan.step_up_target ?? auditScore + 1)}
      ifThen={plan.if_obstacle && plan.if_response ? `If ${plan.if_obstacle.trim()}, then I’ll ${plan.if_response.trim()}.` : null}
    />
  );
}
