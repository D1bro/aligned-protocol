// The Next Step (Duane, 10 Nov 2026): the system that follows The Aligned
// Protocol and replaces My Plan. The Protocol shows where you are; a Next Step
// is the one change that gets you out of where you're stuck in one area.
// Pure helpers and wording; the reads and writes are in
// lib/actions/next-step.ts. Each Next Step is a goals row (migration 0029).

export const SCREENS = [
  "Where you are",
  "Where you’d love it to be",
  "Your Next Step",
  "What’s in the way",
  "What it’ll take",
] as const;

const filled = (v: string | null | undefined) => !!v?.trim();

// Set: finished through The Next Step, or a plan finished through the old
// My Plan before it (those count as Next Steps too).
export function isSet(goal: { set_at?: string | null; frequency?: string | null; success_criteria?: string | null } | null | undefined): boolean {
  if (!goal) return false;
  return !!goal.set_at || (filled(goal.frequency) && filled(goal.success_criteria));
}

// Where to pick up setting a Next Step: the first screen that isn't done
// (6 = all done, ready to take it on). Screens 1 and 2 are free writing, so
// once the Next Step itself exists they count as visited.
export function resumeScreen(
  plan: { current_reality?: string | null; life_vision?: string | null },
  goal: { goal_title?: string | null; aim_score?: number | null; motivation_text?: string | null; in_the_way?: string | null; success_criteria?: string | null } | null,
  moveCount: number
): number {
  if (!goal || !filled(goal.goal_title) || goal.aim_score == null || !filled(goal.motivation_text)) {
    if (!filled(plan.current_reality)) return 1;
    if (!filled(plan.life_vision)) return 2;
    return 3;
  }
  if (!filled(goal.in_the_way)) return 4;
  if (!moveCount || !filled(goal.success_criteria)) return 5;
  return 6;
}

// The three checks on screen 3. Not yet on any of them: sharpen it.
export const CHECKS = [
  { key: "different", question: (area: string) => `If this happened, would ${area} feel different?` },
  { key: "reach", question: () => "Is it within reach from where you are now?" },
  { key: "visible", question: () => "Could someone else tell it had happened?" },
] as const;

// "a 5", "an 8".
export function aScore(n: number): string {
  return `${n === 8 ? "an" : "a"} ${n}`;
}

// "2 steps", "one step".
export function stepsBetween(from: number, to: number): string {
  const n = to - from;
  return n === 1 ? "one step" : `${n} steps`;
}

// A move as one line: "Send three messages · Every Monday".
export function moveLine(m: { body: string; when_text?: string | null }): string {
  return m.when_text?.trim() ? `${m.body.trim()} · ${m.when_text.trim()}` : m.body.trim();
}

// Prompts: questions to think with, never answers to tap, so nothing fails
// to fit the area. DRAFT in Duane's voice, for him to rewrite; area-specific
// prompts and examples come later (keyed by the area's name).
export type Prompts = {
  now: string[];
  ten: string[];
  way: string[];
  spill: string[];
  examples: { now: string; ten: string; step: string; why: string; feel: string; way: string; move: string; done: string };
};

const GENERAL: Prompts = {
  now: [],
  ten: [
    "What did you dream of before life got in the way?",
    "What do you dream of now?",
    "What would you be doing, day to day?",
    "How would you know you’d made it?",
  ],
  way: [
    "What do you worry about most?",
    "What keeps coming back?",
    "What are you avoiding?",
    "What have you tried before that didn’t work?",
  ],
  spill: [
    "How are you sleeping?",
    "How are you with the people around you?",
    "What are you putting off because of it?",
    "What does it stop you thinking about?",
  ],
  examples: {
    now: "In your own words…",
    ten: "If this area were a 10…",
    step: "The one change that would get me unstuck",
    why: "It would take off me…",
    feel: "The day it happens, I’ll feel…",
    way: "What stands between me and it…",
    move: "One thing I can do",
    done: "One clear sign it’s happened",
  },
};

const BY_AREA: Record<string, Partial<Prompts>> = {};

export function promptsFor(area: string): Prompts {
  return { ...GENERAL, ...BY_AREA[area] };
}
