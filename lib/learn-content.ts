// Learn content: Academy paths, Musings and Tools. Plain data so Duane's
// wording can be edited in one place. Everything marked `draft: true` is a
// starting draft for Duane to rewrite in his own voice (or record as video:
// set `video` to a clip URL and its poster).

import type { GuideClip } from "@/lib/audit-guides";

export type Video = { src: string; poster: string | null; captions?: string | null } | null;

export type Lesson = {
  slug: string;
  title: string;
  minutes: number;
  summary: string;
  body: string[];
  reflection: string;
  action: string;
  video: Video;
  draft: boolean;
};

export type Path = { slug: string; title: string; promise: string; lessons: Lesson[] };

export const PATHS: Path[] = [
  {
    slug: "clarity-and-direction",
    title: "Clarity and direction",
    promise: "Choose one place to start, understand why it matters, and turn that into one clear step.",
    lessons: [
      {
        slug: "seeing-where-you-are",
        title: "Seeing where you are",
        minutes: 5,
        summary: "Your scores are information, not a verdict.",
        body: [
          "The audit asks for honesty, not perfection. A low score isn’t a judgement on you — it’s a signal that something in that area isn’t working the way you want it to yet.",
          "Look at your snapshot as a whole before you look at any single number. Notice where things feel steady, where they feel stretched, and where your notes say more than the score does.",
          "Clarity starts here: seeing things as they are, without dressing them up or talking them down.",
        ],
        reflection: "Which score surprised you most, and why?",
        action: "Re-read your notes for your starting area and underline the one sentence that feels most true.",
        video: null,
        draft: true,
      },
      {
        slug: "choosing-one-place-to-start",
        title: "Choosing one place to start",
        minutes: 5,
        summary: "One area, done properly, moves more than ten done halfway.",
        body: [
          "It’s tempting to fix everything at once. That usually means nothing gets the attention it needs.",
          "Pick the area that, if it moved even one point, would make other areas easier. Often that’s your lowest score — but not always. Sometimes it’s the one that holds the others back.",
          "Whatever you choose, notice why. Your reason is part of your clarity.",
        ],
        reflection: "If this area moved one point, what else would get easier?",
        action: "Write down the area you’re choosing and one sentence on why.",
        video: null,
        draft: true,
      },
      {
        slug: "what-matters-here",
        title: "What matters here",
        minutes: 6,
        summary: "Direction comes from what you value, not what you think you should want.",
        body: [
          "A goal borrowed from someone else is hard to keep. A goal tied to what genuinely matters to you has its own pull.",
          "Ask what this area would give you if it were working: time, calm, confidence, freedom, connection. That’s the direction you’re heading in.",
          "You don’t need the whole picture. You need enough of it to choose your next step with conviction.",
        ],
        reflection: "Why does this area matter to you — not to anyone else?",
        action: "Finish the sentence: “When this area is right, I…”",
        video: null,
        draft: true,
      },
      {
        slug: "from-clarity-to-one-step",
        title: "From clarity to one step",
        minutes: 6,
        summary: "The next point up is closer than the finish line — and more useful.",
        body: [
          "Picture this area at a 10 if you like, but plan for the next point up. One honest step is something you can start this week.",
          "A good step is small enough to do on a bad week, specific enough that you’d know you’d done it, and yours to control.",
          "That step becomes your plan. Come back to it each month and see what’s moved.",
        ],
        reflection: "What would one point better look like this month?",
        action: "Open My plan and write — or check — your next step.",
        video: null,
        draft: true,
      },
    ],
  },
];

export type Musing = { slug: string; title: string; summary: string; body: string[]; question: string; video: Video; draft: boolean };

export const MUSINGS: Musing[] = [
  {
    slug: "doing-well-and-wanting-more",
    title: "Doing well, and still wanting something different",
    summary: "On the quiet gap between how things look and how they feel.",
    body: [
      "You can be doing well by every outside measure and still feel a pull towards something else. That pull isn’t ingratitude. It’s information.",
      "Often we ignore it because it doesn’t fit the story we’ve been telling. But the gap between how things look and how they feel is exactly where alignment work begins.",
      "You don’t have to act on it today. You just have to stop pretending it isn’t there.",
    ],
    question: "Where is there a gap between how your life looks and how it feels?",
    video: null,
    draft: true,
  },
  {
    slug: "small-choices-repeated",
    title: "Small choices, repeated",
    summary: "Who you become is built in ordinary moments.",
    body: [
      "Big decisions get the attention, but identity is mostly built in small, repeated choices: what you do first thing, what you say yes to, what you let slide.",
      "Each one is a vote for the person you’re becoming. None of them feels important on its own. Together, they’re everything.",
      "Pick one small choice this week and make it on purpose.",
    ],
    question: "Which small choice, made on purpose, would say the most about who you want to be?",
    video: null,
    draft: true,
  },
];

export type Tool = { slug: string; title: string; purpose: string; prompts: { key: string; label: string; placeholder: string }[] };

export const TOOLS: Tool[] = [
  {
    slug: "who-im-becoming",
    title: "Who I’m becoming",
    purpose: "Put words to the person you want to grow into.",
    prompts: [
      { key: "becoming", label: "The person I want to become is…", placeholder: "Someone who…" },
      { key: "words", label: "Three words I’d like people to use about me", placeholder: "Calm, reliable, brave" },
      { key: "choice", label: "One choice that person would make this week", placeholder: "They would…" },
    ],
  },
  {
    slug: "what-matters-most",
    title: "What matters most",
    purpose: "Find the direction behind your goals.",
    prompts: [
      { key: "more", label: "What do I want more of?", placeholder: "" },
      { key: "less", label: "What do I want less of?", placeholder: "" },
      { key: "year", label: "If nothing changed in a year, how would I feel?", placeholder: "" },
    ],
  },
  {
    slug: "what-gets-in-the-way",
    title: "What gets in the way",
    purpose: "Understand the obstacle that keeps showing up.",
    prompts: [
      { key: "obstacle", label: "The obstacle that keeps showing up", placeholder: "" },
      { key: "usually", label: "When it shows up, I usually…", placeholder: "" },
      { key: "next", label: "Next time, I’ll…", placeholder: "" },
    ],
  },
  {
    slug: "action-planner",
    title: "Action planner",
    purpose: "Turn an intention into something you’ll actually do.",
    prompts: [
      { key: "what", label: "What exactly will I do?", placeholder: "Start with a verb" },
      { key: "when", label: "When and where?", placeholder: "Sundays at 6pm, at the kitchen table" },
      { key: "easy", label: "How will I make it easy to start?", placeholder: "" },
      { key: "miss", label: "If I miss it, I’ll…", placeholder: "" },
    ],
  },
  {
    slug: "looking-back",
    title: "Looking back",
    purpose: "Review what happened, without judgement.",
    prompts: [
      { key: "did", label: "What did I do?", placeholder: "" },
      { key: "helped", label: "What helped?", placeholder: "" },
      { key: "way", label: "What got in the way?", placeholder: "" },
      { key: "next", label: "What will I keep, change or stop?", placeholder: "" },
    ],
  },
];

export function findLesson(pathSlug: string, lessonSlug: string) {
  const path = PATHS.find((p) => p.slug === pathSlug);
  if (!path) return null;
  const i = path.lessons.findIndex((l) => l.slug === lessonSlug);
  if (i === -1) return null;
  return { path, lesson: path.lessons[i], index: i, next: path.lessons[i + 1] ?? null };
}

// A video slot for the GuideVideo player; shows "Video coming soon" until a clip is set.
export function clipFor(id: string, title: string, video: Video): GuideClip {
  return {
    id,
    title,
    label: title,
    src: video?.src ?? null,
    poster: video?.poster ?? null,
    captions: video?.captions ?? null,
    durationSeconds: 0,
  };
}
