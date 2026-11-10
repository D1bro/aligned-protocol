import type { CheckIn } from "@/lib/actions/checkins";

// Display labels for check-in answers (kept out of the server-actions file,
// which may only export async functions).
export const DID_IT_LABELS: Record<CheckIn["did_it"], string> = {
  not_yet: "Not yet",
  sometimes: "Sometimes",
  most: "Most of the time",
  every: "Every time",
};

// The weekly review's answers (migration 0021).
export const WEEKLY_LABELS: Record<string, string> = {
  done: "Done",
  partly: "Partly",
  missed: "Not this week",
  keep: "Kept it",
  smaller: "Made it smaller",
  change: "Changed it",
};

// The Next Step's weekly check-in (migration 0029).
export const CLOSER_LABELS: Record<string, string> = { closer: "Closer", same: "About the same", further: "Further away" };

// One line for any review row, weekly or monthly, for the coach's views.
export function reviewLine(c: { kind?: unknown; did_it: unknown; area_score: unknown; next_step: unknown; closer?: unknown }, next: Record<string, string>) {
  if (c.kind === "weekly" && c.closer) return `Weekly check-in · ${CLOSER_LABELS[String(c.closer)] ?? c.closer}`;
  // Taking a Next Step re-scores the area (recorded like a monthly review, with no "did it").
  if (c.kind !== "weekly" && !c.did_it && c.next_step === "done") return `Next Step taken · ${c.area_score}/10`;
  if (c.kind === "weekly") return `Weekly review · ${WEEKLY_LABELS[String(c.did_it)] ?? c.did_it} · ${WEEKLY_LABELS[String(c.next_step)] ?? c.next_step}`;
  return `Monthly review · ${DID_IT_LABELS[c.did_it as CheckIn["did_it"]] ?? c.did_it} · ${c.area_score}/10 · ${next[String(c.next_step)] ?? c.next_step}`;
}
