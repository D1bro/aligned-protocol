import { redirect } from "next/navigation";
import { getBuildContext } from "@/lib/actions/next-step";
import { resumeScreen } from "@/lib/next-step";
import { NextStepWizard } from "../NextStepWizard";

// Setting a Next Step for one area: /next-step/build?plan=…, opening where
// they left off, or on ?step=N to change an answer.
export default async function BuildNextStepPage({ searchParams }: { searchParams: Promise<{ plan?: string; step?: string }> }) {
  const { plan: planId, step } = await searchParams;
  if (!planId) redirect("/next-step");
  const ctx = await getBuildContext(planId);
  if (!ctx) redirect("/next-step");
  const resume = resumeScreen(ctx.plan, ctx.goal, ctx.moves.length);
  const asked = step ? Math.min(5, Math.max(1, Number(step) || 1)) : null;
  // Already set and not changing anything: show it set.
  if (!asked && ctx.goal?.set_at) redirect(`/next-step/set?plan=${planId}`);
  return <NextStepWizard key={`${planId}:${asked ?? resume}`} ctx={ctx} startScreen={asked ?? Math.min(5, resume)} />;
}
