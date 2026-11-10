import { redirect } from "next/navigation";
import { getMainGoal } from "@/lib/actions/goals";

// The old review link (in emails already sent): the weekly check-in on
// their main Next Step.
export default async function PlanReviewPage() {
  const main = await getMainGoal();
  redirect(main ? `/next-step/check-in?goal=${main.goal.id}` : "/next-step");
}
