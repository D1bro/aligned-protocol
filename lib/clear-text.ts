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
