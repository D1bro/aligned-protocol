import type { CheckIn } from "@/lib/actions/checkins";

// Display labels for check-in answers (kept out of the server-actions file,
// which may only export async functions).
export const DID_IT_LABELS: Record<CheckIn["did_it"], string> = {
  not_yet: "Not yet",
  sometimes: "Sometimes",
  most: "Most of the time",
  every: "Every time",
};
