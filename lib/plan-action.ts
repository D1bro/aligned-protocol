// Build your plan: the five guided steps, and the rules that turn step 4's
// answers into one clear action ("Every Sunday at 6pm, after dinner, I'll
// spend ten minutes on my spending sheet."). Kept free of server-only
// imports so the rules can be tested directly.

export const STEP_NAMES = ["Your starting point", "What better looks like", "What’s in the way", "Your action", "How you’ll know"];

// Step 4's smallest version is stored as "If it’s a hard week, then I’ll …".
export const HARD_WEEK = "it’s a hard week";

// The smallest version, for plans built with the five steps (older plans
// used free if-then wording, which isn't a smaller action).
export function fallbackOf(plan: { if_obstacle?: string | null; if_response?: string | null } | null | undefined): string {
  return plan?.if_obstacle?.trim() === HARD_WEEK ? (plan.if_response?.trim() ?? "") : "";
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

// Step 3: tap the one most likely to get in the way. "Nothing obvious yet"
// is a real answer.
export const WAY_OPTIONS = [
  "Time runs out",
  "I put it off when it feels hard",
  "I lose motivation after a few days",
  "Other people’s needs come first",
  "I’m not sure where to start",
  "Low energy",
  "Nothing obvious yet",
];

// Step 4's starting ideas, by area. Each is "what exactly", ready to adjust.
export const ACTION_IDEAS: Record<string, { label: string; what: string }[]> = {
  "Health & Energy": [
    { label: "A short walk", what: "go for a 20-minute walk" },
    { label: "An earlier night", what: "turn my phone off and go to bed by 10:30pm" },
    { label: "Lunch ready", what: "prepare tomorrow’s lunch" },
  ],
  "Mindset & Thinking": [
    { label: "Three good things", what: "write down three things that went well" },
    { label: "A kinder thought", what: "notice one unhelpful thought and write a kinder version" },
    { label: "Steadying reading", what: "read something that steadies me for ten minutes" },
  ],
  "Confidence & Self-Belief": [
    { label: "Notice a win", what: "write down one thing I handled well" },
    { label: "One small yes", what: "say yes to one small thing I’d normally avoid" },
    { label: "Speak up once", what: "speak up once in a meeting or conversation" },
  ],
  "Relationships & Connection": [
    { label: "Message a friend", what: "message one friend I haven’t spoken to in a while" },
    { label: "Phone-free dinner", what: "have a phone-free dinner with someone at home" },
    { label: "Call family", what: "call a family member for ten minutes" },
  ],
  "Career, Work & Business": [
    { label: "Most important task first", what: "spend 30 minutes on my most important task before email" },
    { label: "One career step", what: "spend 20 minutes on one step of my next career move" },
    { label: "Tomorrow’s top three", what: "write tomorrow’s top three priorities before I finish work" },
  ],
  "Money & Stability": [
    { label: "Check my spending", what: "spend ten minutes on my spending sheet" },
    { label: "Bill calendar", what: "put every bill date into my calendar" },
    { label: "Payday savings", what: "move a set amount into savings" },
  ],
  "Purpose & Direction": [
    { label: "Write what matters", what: "spend 15 minutes writing about what matters to me" },
    { label: "Something meaningful", what: "give an hour to something that feels meaningful" },
    { label: "Learn towards it", what: "read or listen to something connected to where I’m heading" },
  ],
  "Daily Structure & Discipline": [
    { label: "Plan tomorrow", what: "plan tomorrow in five minutes before bed" },
    { label: "Same wake-up", what: "get up at the same time" },
    { label: "Clear my space", what: "tidy my workspace for ten minutes at the end of the day" },
  ],
  "Emotional Wellbeing": [
    { label: "Ten quiet minutes", what: "take ten quiet minutes to notice how I’m feeling" },
    { label: "Walk without my phone", what: "go outside for 15 minutes without my phone" },
    { label: "Empty my head", what: "write down what’s on my mind before bed" },
  ],
  "Self-Respect & Identity": [
    { label: "Time for me", what: "spend 20 minutes on something just for me" },
    { label: "One honest no", what: "say no to one request that doesn’t fit my priorities" },
    { label: "Keep a promise", what: "do the one thing I promised myself I’d do" },
  ],
};

// Words that make an action hard to tick off.
const VAGUE = /\b(more|better|less|try|trying|start|focus on|be|improve|properly|healthier|work on)\b/i;

// The step-4 check: "Would someone watching know whether you did it?"
// Returns what to fix, or null when the action is clear.
export function actionHint(action: string, days: string[], time: string): string | null {
  const a = action.trim();
  const vague = a.match(VAGUE)?.[0];
  if (vague) return `“${vague}” is hard to tick off. What exactly will you do?`;
  if (a.split(/\s+/).filter(Boolean).length < 2) return "Say exactly what you’ll do: what would someone see you doing?";
  if (!days.length) return "Choose the day, so you know when it’s happening.";
  if (!time) return "Add a time, so it has a place in your day.";
  return null;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

function listDays(days: string[]) {
  const full = DAYS.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]);
  if (full.length <= 1) return full.join("");
  return `${full.slice(0, -1).join(", ")} and ${full[full.length - 1]}`;
}

// "Every Sunday at 6pm, after dinner" — stored as the goal's action_when.
export function whenPhrase(days: string[], time: string, after: string) {
  const on = days.length === 7 ? "Every day" : days.length ? `Every ${listDays(days)}` : "";
  const at = time ? ` at ${formatTime(time)}` : "";
  const cue = after.trim().replace(/[.\s]+$/, "");
  return `${on}${at}`.trim() + (cue ? `, ${cue.charAt(0).toLowerCase()}${cue.slice(1)}` : "");
}

// How often, for the goal's frequency (kept for the coach views and reminders).
export function frequencyOf(days: string[]) {
  return days.length === 7 ? "Daily" : days.length === 1 ? "Weekly" : days.length ? "A few times a week" : "";
}

// The goal sentence, written for them.
export function goalSentence(days: string[], time: string, after: string, action: string) {
  let act = action.trim().replace(/[.\s]+$/, "").replace(/^(i'?ll|i’ll|i will|i)\s+/i, "");
  if (!act) return "";
  act = act.charAt(0).toLowerCase() + act.slice(1);
  const when = whenPhrase(days, time, after);
  return when ? `${when}, I’ll ${act}.` : `I’ll ${act}.`;
}

// Reading a saved action_when back into the step-4 fields.
export function parseWhen(text: string | null | undefined): { days: string[]; time: string; after: string } {
  const t = text ?? "";
  const lower = t.toLowerCase();
  const days = /\bevery day\b/.test(lower) ? [...DAYS] : DAYS.filter((d) => lower.includes(DAY_NAMES[d].toLowerCase()));
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  let time = "";
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    time = `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
  }
  const comma = t.indexOf(",", /\bat\b/i.test(t) ? t.search(/\bat\b/i) : 0);
  const after = comma === -1 ? "" : t.slice(comma + 1).trim();
  return { days, time, after };
}

// A plan has started once they've gone past step 1 (the starting point,
// answered on the snapshot). Until then the area can still be changed.
export function planStarted(plan: {
  why_it_matters?: string | null;
  life_vision?: string | null;
  emotional_blocks?: string | null;
  blocks?: string[] | null;
}): boolean {
  const f = (v: string | null | undefined) => !!v?.trim();
  return f(plan.why_it_matters) || f(plan.life_vision) || f(plan.emotional_blocks) || (plan.blocks?.length ?? 0) > 0;
}
