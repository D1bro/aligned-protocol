// The shape of an AI-drafted session summary, and the rules that keep it
// honest before the coach sees it. No server-only imports, so it can be tested.

export type DraftAction = { text: string; due_date: string; goal_id: string; source_excerpt: string; source_time: string; uncertain: boolean };

export type AiDraft = {
  focus: string;
  summary: string;
  insights: string[];
  client_actions: DraftAction[];
  coach_actions: DraftAction[];
  // date/time only when a specific one was agreed; the coach still books it.
  next_meeting: { mentioned: boolean; text: string; source_excerpt: string; date: string; time: string; duration_minutes: number };
  review_flags: string[];
  // For the coach only (never shared): observations, themes, what to explore.
  coach_note: string;
  // Shared with the client once approved; the client still chooses in My plan.
  suggested_focus: { area: string; goal: string; why: string };
  // For the coach only: what to check in on next time.
  prep: string[];
};

// Drop anything in a draft that doesn't fit the app: goal links to goals the
// client doesn't have, malformed dates and times, unknown areas. What's left
// is still only a suggestion for the coach to review.
export function tidyDraft(parsed: AiDraft, goalIds: string[], areas: string[]): AiDraft {
  const ids = new Set(goalIds);
  for (const a of [...parsed.client_actions, ...parsed.coach_actions]) {
    if (!ids.has(a.goal_id)) a.goal_id = "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.due_date)) a.due_date = "";
  }
  const m = parsed.next_meeting;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date ?? "")) m.date = "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time ?? "")) m.time = "";
  if (!Number.isInteger(m.duration_minutes) || m.duration_minutes < 5 || m.duration_minutes > 600) m.duration_minutes = 0;
  if (!areas.includes(parsed.suggested_focus?.area ?? "")) parsed.suggested_focus = { area: "", goal: "", why: "" };
  parsed.coach_note = typeof parsed.coach_note === "string" ? parsed.coach_note : "";
  parsed.prep = Array.isArray(parsed.prep) ? parsed.prep.filter((x) => typeof x === "string" && x.trim()).slice(0, 5) : [];
  return parsed;
}

