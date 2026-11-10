import Link from "next/link";
import { formatDate } from "@/lib/audit-schedule";
import type { PlanStage } from "@/lib/actions/clear";
import { ScoreTrack } from "./ScoreTrack";

export type PlanCardProps = {
  areaName: string;
  score: number;
  target: number | null;
  stage: PlanStage;
  step: number;
  goalTitle: string | null;
  frequency: string | null;
  nextAuditDue: string; // ISO date
  // Once the plan is set: the next review (ISO date).
  nextCheckIn?: string | null;
  // Hide the button where the page already offers the same action.
  hideAction?: boolean;
};

// Their Next Step at a glance — the same card on the snapshot and the
// Protocol page, so every page agrees on where they are.
export function PlanCard({ areaName, score, target, stage, step, goalTitle, frequency, nextAuditDue, nextCheckIn, hideAction }: PlanCardProps) {
  const cta =
    stage === "done"
      ? { href: "/next-step", label: "Open The Next Step" }
      : stage === "in_progress"
        ? { href: "/next-step", label: "Carry on →" }
        : { href: "/next-step", label: "Find my Next Step →" };

  return (
    <section className="plan-card" aria-label="Your Next Step">
      <div className="eyebrow"><span className="eydot" /> Your Next Step</div>
      <h3>{areaName}</h3>
      <ScoreTrack score={score} target={target} />
      {stage === "done" && goalTitle ? (
        <p className="plan-card-goal">
          {goalTitle.trim()}
          {frequency ? <span> · {frequency.trim()}</span> : null}
        </p>
      ) : (
        <p className="plan-card-status">
          {stage === "in_progress" ? `Part way through: screen ${step} of 5.` : "Ready to find the one step that gets you unstuck."}
        </p>
      )}
      <div className="plan-card-foot">
        {hideAction ? null : (
          <Link href={cta.href} className={stage === "done" ? "btn btn-o" : "btn btn-p"}>{cta.label}</Link>
        )}
        <span>{nextCheckIn ? `Next check-in ${formatDate(nextCheckIn)}` : `Suggested next audit ${formatDate(nextAuditDue)}`}</span>
      </div>
    </section>
  );
}
