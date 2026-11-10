// The Next Step review (Duane, 10 Nov 2026): before a session, the app reads
// the member's Next Step and points the coach at what to sharpen, each with
// the question that gets the member there. The job is to make their words
// specific, measurable and pulling them forward, so they and their coach both
// know when it's done. These are the checks the app can make by itself; the
// AI read (lib/ai-step-review.ts) adds what rules can't see. Pure helpers.

import { looksLikeSeveral } from "./next-step.ts";
import { moveDays } from "./daily-log.ts";

export type ReviewPart = "why" | "step" | "done" | "aim" | "moves" | "way";
export const PART_LABEL: Record<ReviewPart, string> = {
  why: "Why",
  step: "The step",
  done: "Done when",
  aim: "How far",
  moves: "Moves",
  way: "In the way",
};
export type ReviewFlag = { part: ReviewPart; flag: string; ask: string };

// Words that push away from a feeling rather than pull towards one.
const AWAY = /\b(shame|ashamed|guilt|guilty|disappoint\w*|embarrass\w*|failure|failing|lazy|useless|hate|sick of|fed up|let (myself|my\w*|\w+) (down|slip)|should(n['’]t)?|have to|must)\b/i;
const COUNTABLE = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twice|once|every|each|a week|a day|a month)\b/i;
const STOP = new Set(["about", "after", "again", "always", "because", "before", "being", "could", "doing", "every", "feel", "feeling", "from", "going", "have", "into", "just", "like", "make", "more", "much", "other", "really", "should", "something", "than", "that", "then", "there", "thing", "things", "this", "time", "when", "where", "which", "while", "with", "would", "your"]);
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));

// A move that holds two things: two sentences, or "and" between two actions
// ("Go to the gym and eat well"). One move, one tick.
export function twoInOne(move: string): boolean {
  const m = move.trim().replace(/[.;!]+\s*$/, "");
  if (/[.;]\s*\S/.test(m)) return true;
  return /\b(and (then|also)|as well as)\b/i.test(m) || /\band\s+(go|do|eat|get|make|write|read|call|book|start|stop|try|walk|run|have|keep|take|send|plan|tidy|spend)\b/i.test(m);
}

export type ReviewInput = {
  title: string;
  why: string | null;
  done: string | null;
  countTarget: number | null;
  start: number | null;
  aim: number | null;
  inTheWay: string | null;
  moves: { body: string; when_text: string | null }[];
};

export function reviewFlags(g: ReviewInput): ReviewFlag[] {
  const out: ReviewFlag[] = [];
  const why = g.why?.trim() ?? "";
  if (why && AWAY.test(why)) {
    out.push({ part: "why", flag: "Pushes away from a feeling. It shows on their card every week.", ask: "When you’ve done it, what do you feel?" });
  }
  if (looksLikeSeveral(g.title)) {
    out.push({ part: "step", flag: "Looks like more than one step.", ask: "Which one, if it happened, makes the other easier?" });
  }
  const done = g.done?.trim() ?? "";
  if (!done) {
    out.push({ part: "done", flag: "No finish line yet.", ask: "What would we both see that tells us it’s done?" });
  } else if (!g.countTarget && !COUNTABLE.test(done)) {
    out.push({ part: "done", flag: "Nothing to count, so neither of you will know when it’s taken.", ask: "What would we both see that tells us it’s done?" });
  }
  if (g.start && g.aim && g.aim - g.start >= 3) {
    out.push({ part: "aim", flag: `${g.aim - g.start} points for one step. Likely to feel like failing at the re-score.`, ask: "With this done, where is it, honestly?" });
  }
  const doubled = g.moves.filter((m) => twoInOne(m.body));
  if (doubled.length) {
    out.push({ part: "moves", flag: `${doubled.length === 1 ? "A move holds" : `${doubled.length} moves hold`} more than one thing: “${doubled[0].body}”.`, ask: "Which of these is the one you’ll tick?" });
  }
  const noDays = g.moves.filter((m) => m.when_text?.trim() && !moveDays(m.when_text).length && /\b(gym|class|walk|run|write|read|practice|session|week)\b/i.test(m.body));
  if (noDays.length) {
    out.push({ part: "moves", flag: `“${noDays[0].body}” has no days, so it shows in Today only until it’s ticked once.`, ask: "Which days will you do it?" });
  }
  if (!g.moves.length) {
    out.push({ part: "moves", flag: "No moves yet.", ask: "What’s the first thing you could do this week?" });
  }
  const way = g.inTheWay?.trim() ?? "";
  if (way) {
    const wayWords = words(way);
    const answered = g.moves.some((m) => [...words(`${m.body} ${m.when_text ?? ""}`)].some((w) => wayWords.has(w)));
    if (!answered) out.push({ part: "way", flag: "No move answers it yet.", ask: "When that happens, what will you do instead?" });
  }
  return out;
}

// The sharper version agreed in a session, as the coach writes it and the
// member keeps it. Moves keep their id where they're an existing move, so
// keeping the review edits them in place and their ticks stay with them.
export type ReviewContent = {
  why?: string;
  title?: string;
  name?: string;
  done?: string;
  countTarget?: number | null;
  // Which of `moves` is counted towards "done when" (its index), if any.
  countMove?: number | null;
  aim?: number | null;
  moves?: { id?: string; body: string; when: string }[];
  // The coach's words to the member, shown above the changes.
  note?: string;
  // The AI read, for the coach alone (never shown to the member).
  ai?: { flags: ReviewFlag[]; worked: string[]; opening: string; at: string };
};

// Only what the member sees: the AI read stays with the coach.
export function forMember(c: ReviewContent): Omit<ReviewContent, "ai"> {
  const rest = { ...c };
  delete rest.ai;
  return rest;
}

// What changes on their Next Step if they keep it, part by part.
export type ReviewChange = { label: string; before: string; after: string };
export function reviewChanges(
  c: ReviewContent,
  now: { title: string; name: string | null; why: string | null; done: string | null; aim: number | null; countTarget: number | null; moves: { id: string; body: string; when_text: string | null }[] }
): ReviewChange[] {
  const out: ReviewChange[] = [];
  const diff = (label: string, before: string | null | undefined, after: string | null | undefined) => {
    const a = (after ?? "").trim();
    if (a && a !== (before ?? "").trim()) out.push({ label, before: (before ?? "").trim(), after: a });
  };
  diff("Your Next Step", now.title, c.title);
  diff("Its name", now.name, c.name);
  diff("Why", now.why, c.why);
  diff("Done when", now.done, c.done);
  if (c.countTarget && c.countMove != null && c.moves?.[c.countMove]) {
    const counted = `${c.countTarget} × ${c.moves[c.countMove].body}`;
    if (counted !== (now.countTarget ? `${now.countTarget}` : "")) out.push({ label: "Counted", before: now.countTarget ? `${now.countTarget}` : "", after: counted });
  }
  if (c.aim && c.aim !== now.aim) out.push({ label: "How far", before: now.aim ? `${now.aim}` : "", after: `${c.aim}` });
  if (c.moves?.length) {
    const line = (m: { body: string; when?: string | null; when_text?: string | null }) => `${m.body}${(m.when ?? m.when_text)?.trim() ? ` · ${(m.when ?? m.when_text)!.trim()}` : ""}`;
    const before = now.moves.map(line).join("\n");
    const after = c.moves.map(line).join("\n");
    if (before !== after) out.push({ label: "Moves", before, after });
  }
  return out;
}
