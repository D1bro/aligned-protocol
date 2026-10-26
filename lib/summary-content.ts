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
