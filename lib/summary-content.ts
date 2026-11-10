// Shared by the summary actions and the session desk. (A "use server" file
// may only export async functions, so constants live here.)
import type { SummaryContent } from "@/lib/actions/summaries";

export const EMPTY_CONTENT: SummaryContent = {
  focus: "",
  summary: "",
  insights: [],
  client_actions: [],
  coach_actions: [],
  resources: [],
  next_meeting: { text: "" },
  points: [],
  suggested_focus: { area_id: "", area_name: "", goal: "", why: "" },
};

// Is this text already in the coach's note? Whitespace doesn't count. Used so
// "Add to my private note" and the check-in list never add the same block
// twice (it happened to David's notes before 10 Nov 2026).
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
export function alreadyInNote(body: string, text: string): boolean {
  const t = squash(text);
  return t.length > 0 && squash(body).includes(t);
}
