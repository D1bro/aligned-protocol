import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getLifeAreas } from "@/lib/actions/audit";
import { getOrCreateClearPlan, getGoalForPlan } from "@/lib/actions/clear";
import { ClearWizard } from "./ClearWizard";

export default async function ClearPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");
  if (!audit.focus_area_id) redirect("/audit/results");

  const areas = await getLifeAreas();
  const area = areas.find((a) => a.id === audit.focus_area_id);
  if (!area) redirect("/audit/results");

  const plan = await getOrCreateClearPlan(audit.id, area.id);
  const goal = await getGoalForPlan(plan.id);

  return <ClearWizard area={area} plan={plan} goal={goal} />;
}
