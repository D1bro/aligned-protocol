import { redirect } from "next/navigation";
import { getNextStep } from "@/lib/actions/next-step";
import { TakenForm } from "./TakenForm";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "You took your Next Step": /next-step/taken?goal=…
export default async function NextStepTakenPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal: goalId } = await searchParams;
  const ctx = goalId ? await getNextStep(goalId) : null;
  if (!ctx || (ctx.goal.status !== "active" && !ctx.goal.taken_at)) redirect("/next-step");
  const { goal } = ctx;
  const started = goal.set_at ?? goal.created_at;
  const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });
  return (
    <div className="page au-page ns-page ns-taken">
      <div className="eyebrow"><span className="eydot" /> {ctx.area}</div>
      <h1 className="ns-taken-h">You took your <em>Next Step.</em></h1>
      <p className="ns-taken-step">{cap(goal.goal_title.trim())}</p>
      <p className="au-small ns-center">
        {started ? `Started ${short(started)} · ` : ""}{ctx.moves.filter((m) => m.done_at).length} of {ctx.moves.length} moves done
      </p>
      <TakenForm goalId={goal.id} area={ctx.area} areaId={ctx.areaId} start={goal.start_score ?? null} aim={goal.aim_score ?? null} />
    </div>
  );
}
