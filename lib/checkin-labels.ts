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

// One line for any review row, weekly or monthly, for the coach's views.
export function reviewLine(c: { kind?: unknown; did_it: unknown; area_score: unknown; next_step: unknown }, next: Record<string, string>) {
  if (c.kind === "weekly") return `Weekly review · ${WEEKLY_LABELS[String(c.did_it)] ?? c.did_it} · ${WEEKLY_LABELS[String(c.next_step)] ?? c.next_step}`;
  return `Monthly review · ${DID_IT_LABELS[c.did_it as CheckIn["did_it"]] ?? c.did_it} · ${c.area_score}/10 · ${next[String(c.next_step)] ?? c.next_step}`;
}
