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
// to fit the area. DRAFT in Duane's voice, for him to rewrite.
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

// Each area adds one question of its own to "what would a 10 look like?"
// and "what's in the way?", and has its own example wording in the boxes.
// DRAFT in Duane's voice (10 Nov 2026), for him to rewrite.
type AreaPrompts = { ten: string; way: string; examples: Prompts["examples"] };

const BY_AREA: Record<string, AreaPrompts> = {
  "Health & Energy": {
    ten: "What would you have the energy for that you don’t now?",
    way: "What do you reach for when you’re tired?",
    examples: {
      now: "I’m running on caffeine and I’m flat by mid-afternoon…",
      ten: "I wake up rested, move every day and have energy left for the evening…",
      step: "Get to bed by 11 on work nights",
      why: "Being exhausted is making everything else harder…",
      feel: "Clear-headed in the mornings…",
      way: "Scrolling late, because it’s the only time that feels like mine…",
      move: "Phone charging outside the bedroom",
      done: "Two weeks of 11pm nights, and I notice the difference",
    },
  },
  "Mindset & Thinking": {
    ten: "What would you believe about yourself that you don’t yet?",
    way: "What does the voice in your head say when you try?",
    examples: {
      now: "I talk myself out of things before I’ve started…",
      ten: "My thinking works for me, not against me…",
      step: "Catch the story I tell myself and write down what’s actually true",
      why: "I’m tired of being the one who stops me…",
      feel: "Calmer, like I’m on my own side…",
      way: "The old story feels true because I’ve told it for years…",
      move: "Write the thought and the fact side by side",
      done: "I can name the story when it starts, and it doesn’t decide for me",
    },
  },
  "Confidence & Self-Belief": {
    ten: "Where would you show up that you hold back from now?",
    way: "Whose opinion are you most afraid of?",
    examples: {
      now: "I hold back and second-guess myself afterwards…",
      ten: "I speak up, back myself and take up space…",
      step: "Say one idea out loud in every team meeting",
      why: "Staying quiet keeps me invisible…",
      feel: "Lighter, like I belong in the room…",
      way: "I worry I’ll say something obvious…",
      move: "Write one point down before each meeting",
      done: "I’ve spoken up four meetings in a row",
    },
  },
  "Relationships & Connection": {
    ten: "Who would be in your life, and how would it feel to be with them?",
    way: "What conversation have you been avoiding?",
    examples: {
      now: "In your own words, about the relationships that matter most…",
      ten: "Relationships that feel loving, clear and safe…",
      step: "The one change in a relationship that would take the weight off",
      why: "It would take off me…",
      feel: "The day it happens, I’ll feel…",
      way: "What I’m afraid would happen if I tried…",
      move: "One honest conversation, or one step towards it",
      done: "Something I, or someone else, would notice had changed",
    },
  },
  "Career, Work & Business": {
    ten: "What work would you be proud to be known for?",
    way: "What are you tolerating at work that you wouldn’t advise a friend to?",
    examples: {
      now: "I’m busy all the time but I’m not moving forward…",
      ten: "Work that fits who I am and grows every year…",
      step: "Sign one new client this month",
      why: "One client would cover the bills and give me room to think…",
      feel: "Like it’s actually working…",
      way: "I don’t ask, because I hate feeling like I’m selling…",
      move: "Message three people who might need this",
      done: "A client has signed and paid",
    },
  },
  "Money & Stability": {
    ten: "What would you stop worrying about?",
    way: "What do you avoid looking at?",
    examples: {
      now: "Money is always tight and I dread the first of the month…",
      ten: "No money stress, and the freedom to say yes when it matters…",
      step: "Sign one client at £[X] a month",
      why: "It would cover the bills. The dread would go…",
      feel: "Relief. I can open my banking app without my stomach dropping…",
      way: "I don’t know who would pay for this, and I put off asking…",
      move: "Write my offer on one page",
      done: "A client has signed and paid the first month",
    },
  },
  "Purpose & Direction": {
    ten: "What would you be working towards that really matters to you?",
    way: "What are you waiting to be sure of before you move?",
    examples: {
      now: "I’m getting through the weeks but I don’t know what it’s for…",
      ten: "I know what I’m here to do, and my days point that way…",
      step: "Decide what I want next, and say it out loud",
      why: "Drifting is costing me years…",
      feel: "Like I’ve finally got a direction…",
      way: "I’m scared of choosing the wrong thing…",
      move: "Write what I’d do if no one was watching",
      done: "I’ve said it to one person I trust",
    },
  },
  "Daily Structure & Discipline": {
    ten: "What would an ordinary good day look like, start to finish?",
    way: "Where does your day slip away from you?",
    examples: {
      now: "My days run me rather than the other way round…",
      ten: "Days with a shape, where the important things get done first…",
      step: "Start every workday with one hour on what matters most",
      why: "The important things keep getting pushed…",
      feel: "In charge of my day…",
      way: "Messages first thing, and then the day has gone…",
      move: "Plan tomorrow’s first hour the night before",
      done: "Ten workdays that started with that hour",
    },
  },
  "Emotional Wellbeing": {
    ten: "How would you feel on an ordinary day?",
    way: "What’s been weighing on you that you haven’t said?",
    examples: {
      now: "I’ve been carrying a lot and not saying much…",
      ten: "Steady inside, even when life isn’t…",
      step: "Talk to someone about how I’m really doing",
      why: "I’ve been carrying it on my own for too long…",
      feel: "Lighter, and less alone with it…",
      way: "I don’t want to be a burden…",
      move: "Book a time to talk",
      done: "I’ve had the conversation",
    },
  },
  "Self-Respect & Identity": {
    ten: "Who would you be, by your own standards?",
    way: "Where do you say yes when you mean no?",
    examples: {
      now: "I keep letting things slide that I know matter to me…",
      ten: "I keep my word to myself and hold my own standards…",
      step: "Say no to one thing that crosses my line",
      why: "Every time I don’t, I respect myself a little less…",
      feel: "Proud of myself…",
      way: "I don’t want to let people down…",
      move: "Write down where my line is",
      done: "I’ve said no once, and kept to it",
    },
  },
};

export function promptsFor(area: string): Prompts {
  const a = BY_AREA[area];
  if (!a) return GENERAL;
  return {
    ...GENERAL,
    ten: [a.ten, ...GENERAL.ten.slice(0, 3)],
    way: [a.way, ...GENERAL.way.slice(0, 3)],
    examples: a.examples,
  };
}
