// CLEAR's "current reality" sentence starters, shared by the steps (browser)
// and My plan (server).

// Tapping a prompt adds one of these, so no one faces an empty box.
export const REALITY_PROMPTS = ["What's working: ", "What isn't working: ", "It's been like this for: "];

// The starters alone don't count as an answer.
export const withoutStarters = (t: string) => REALITY_PROMPTS.reduce((acc, p) => acc.split(p.trim()).join(""), t);

// For display: drop starter lines that were tapped but never filled in.
export function cleanReality(t: string | null | undefined) {
  return (t ?? "")
    .split("\n")
    .filter((line) => !REALITY_PROMPTS.some((p) => line.trim() === p.trim()))
    .join("\n")
    .trim();
}

// A gentle check on "success looks like": hard to verify when it has no
// number, time or concrete thing to see. Used only to offer a way to clarify
// it — the person's saved words are never changed.
export function looksHardToVerify(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return false;
  if (/\d/.test(t)) return false;
  const vague = /\b(better|more|less|right direction|a step|progress|improve|improved|happier|good|feel|feeling|on track|sorted)\b/;
  return vague.test(t) || t.split(/\s+/).length < 5;
}
