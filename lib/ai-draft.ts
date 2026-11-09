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
  // Shared with the client once approved; the client still chooses in My Plan.
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


// ---- Coaching reflection (for the coach alone) ----
// Outcome first: where the client moved, what the coach did just before,
// what was left unfinished, patterns worth watching, and one direct
// challenge. Every point carries a timestamp; quotes must be real.

export const COACH_MOVES = ["story", "question", "silence", "reframe", "challenge", "validation", "summary", "other"] as const;
export type CoachMove = (typeof COACH_MOVES)[number];

// How a point stands: what the transcript shows, what the AI reads into it,
// or a choice a coach might reasonably make differently.
export const BASES = ["evidence", "interpretation", "style_choice"] as const;
export type Basis = (typeof BASES)[number];

export type Reflection = {
  movements: { time: string; client_words: string; what_moved: string; coach_move: CoachMove; coach_move_time: string; coach_move_note: string }[];
  unfinished: { time: string; client_words: string; note: string }[];
  // `assumption`: anything taken for granted about this client, to check with them.
  patterns: { pattern: string; evidence_times: string[]; note: string; basis?: Basis; assumption?: string }[];
  challenge: { text: string; evidence_times: string[]; basis?: Basis; assumption?: string };
  // The coach's own learning areas (coach profile), checked in this session.
  practice?: { focus: string; moments: { time: string; what_you_did: string; what_followed: string }[]; summary: string }[];
};

// Loose comparison for "do these words appear in the transcript": case,
// punctuation and spacing differences don't count; invented words do.
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function quoteIsReal(quote: string, transcript: string): boolean {
  const q = squash(quote.replace(/(\.\.\.|…)\s*$/u, ""));
  return q.length >= 3 && squash(transcript).includes(q);
}

// Keep only well-evidenced points: a timestamp on each, client quotes that
// really appear in the transcript, a known coach move. Caps keep it readable.
export function tidyReflection(r: Reflection, transcript: string): Reflection {
  const time = (t: unknown) => (typeof t === "string" ? t.trim() : "");
  const text = (t: unknown, max = 600) => (typeof t === "string" ? t.trim().slice(0, max) : "");
  const times = (v: unknown) => (Array.isArray(v) ? v.map(time).filter(Boolean).slice(0, 6) : []);
  const basis = (v: unknown): Basis => ((BASES as readonly string[]).includes(v as string) ? (v as Basis) : "interpretation");
  return {
    movements: (Array.isArray(r?.movements) ? r.movements : [])
      .filter((m) => time(m.time) && quoteIsReal(text(m.client_words), transcript))
      .map((m) => ({
        time: time(m.time),
        client_words: text(m.client_words, 400),
        what_moved: text(m.what_moved),
        coach_move: (COACH_MOVES as readonly string[]).includes(m.coach_move) ? m.coach_move : "other",
        coach_move_time: time(m.coach_move_time),
        coach_move_note: text(m.coach_move_note),
      }))
      .slice(0, 6),
    unfinished: (Array.isArray(r?.unfinished) ? r.unfinished : [])
      .filter((u) => time(u.time) && quoteIsReal(text(u.client_words), transcript))
      .map((u) => ({ time: time(u.time), client_words: text(u.client_words, 400), note: text(u.note) }))
      .slice(0, 5),
    patterns: (Array.isArray(r?.patterns) ? r.patterns : [])
      .filter((p) => text(p.pattern) && times(p.evidence_times).length)
      .map((p) => ({ pattern: text(p.pattern, 300), evidence_times: times(p.evidence_times), note: text(p.note), basis: basis(p.basis), assumption: text(p.assumption, 300) }))
      .slice(0, 3),
    challenge:
      text(r?.challenge?.text) && times(r?.challenge?.evidence_times).length
        ? { text: text(r.challenge.text), evidence_times: times(r.challenge.evidence_times), basis: basis(r.challenge.basis), assumption: text(r.challenge.assumption, 300) }
        : { text: "", evidence_times: [] },
    // Each learning area keeps only moments with a timestamp.
    practice: (Array.isArray(r?.practice) ? r.practice : [])
      .filter((p) => text(p.focus))
      .map((p) => ({
        focus: text(p.focus, 300),
        moments: (Array.isArray(p.moments) ? p.moments : [])
          .filter((m) => time(m.time))
          .map((m) => ({ time: time(m.time), what_you_did: text(m.what_you_did, 300), what_followed: text(m.what_followed, 300) }))
          .slice(0, 8),
        summary: text(p.summary),
      }))
      .slice(0, 4),
  };
}
