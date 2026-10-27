import Link from "next/link";
import { formatDate } from "@/lib/audit-schedule";
import type { PlanStage } from "@/lib/actions/clear";
import { ScoreTrack } from "./ScoreTrack";

export type PlanCardProps = {
  areaName: string;
  score: number;
  target: number;
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

// The person's plan at a glance — the same card on Home, the snapshot and
// the audit page, so every page agrees on where they are.
export function PlanCard({ areaName, score, target, stage, step, goalTitle, frequency, nextAuditDue, nextCheckIn, hideAction }: PlanCardProps) {
  const cta =
    stage === "done"
      ? { href: "/clear", label: "Open my plan" }
      : stage === "in_progress"
        ? { href: "/clear", label: "Continue my plan →" }
        : { href: "/clear", label: "Build my plan →" };

  return (
    <section className="plan-card" aria-label="Your plan">
      <div className="eyebrow"><span className="eydot" /> Your plan</div>
      <h3>{areaName}</h3>
      <ScoreTrack score={score} target={target} />
      {stage === "done" && goalTitle ? (
        <p className="plan-card-goal">
          {goalTitle.trim()}
          {frequency ? <span> · {frequency.trim()}</span> : null}
        </p>
      ) : (
        <p className="plan-card-status">
          {stage === "in_progress" ? `Plan in progress: step ${step} of 5.` : "Ready to turn this into one clear plan."}
        </p>
      )}
      <div className="plan-card-foot">
        {hideAction ? null : (
          <Link href={cta.href} className={stage === "done" ? "btn btn-o" : "btn btn-p"}>{cta.label}</Link>
        )}
        <span>{nextCheckIn ? `Next review ${formatDate(nextCheckIn)}` : `Suggested next audit ${formatDate(nextAuditDue)}`}</span>
      </div>
    </section>
  );
}
