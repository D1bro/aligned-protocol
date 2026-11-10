import { redirect } from "next/navigation";
import { getNextStep } from "@/lib/actions/next-step";
import { CheckInForm } from "./CheckInForm";

// The weekly check-in for one Next Step: /next-step/check-in?goal=…
export default async function NextStepCheckInPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal: goalId } = await searchParams;
  const ctx = goalId ? await getNextStep(goalId) : null;
  if (!ctx || ctx.goal.status !== "active") redirect("/next-step");
  return (
    <div className="page au-page ns-page">
      <div className="eyebrow"><span className="eydot" /> Weekly check-in · {ctx.area}</div>
      <h1>Is it <em>closer?</em></h1>
      <p className="lead">Your Next Step: <b className="ns-white">{ctx.goal.goal_title}</b>. About a minute.</p>
      <CheckInForm goalId={ctx.goal.id} moves={ctx.moves} editHref={ctx.planId ? `/next-step/build?plan=${ctx.planId}&step=5` : null} />
    </div>
  );
}
