import { SITE } from "./site-copy.ts";

// What Aligned offers at launch (Duane, 11 Nov 2026): one ladder. Prices are
// the total the customer pays; no VAT is charged while Aligned isn't
// VAT-registered.
//
// - Clarity is free and complete: the audit, the Next Step, Today, the
//   journal, the weekly check-in and a rescore when a step is taken.
// - Aligned Practice (the daily practice: morning audio, intention, evening
//   reflection, tools, learning) is not sold on its own. It's included in
//   Momentum and Focus.
// - Momentum is a monthly Stripe subscription (lib/stripe.ts).
// - Focus is a package bought on the Coaching page: four sessions over 12
//   weeks, one payment, Momentum included (packages.includes_membership).
// Until joining is switched on for the live site (lib/membership.ts), the
// buttons ask by email instead.

export type Offer = {
  key: "clarity" | "momentum" | "focus";
  name: string;
  tagline: string;
  price: string;
  // What a new member pays each month, in pence (subscriptions only).
  pricePence?: number;
  per?: string;
  priceNote: string;
  short: string; // one line, for Your plan is set
  intro?: string; // "Everything in …, plus:"
  includes: string[];
  featured?: boolean;
};

// The daily practice, included in Momentum and Focus (never sold alone).
export const PRACTICE = {
  name: "Aligned Practice",
  tagline: "Give what matters a place in your everyday life.",
  includes: [
    "Morning audio and a daily intention",
    "An evening reflection",
    "Values, identity and direction exercises",
    "Tools for what gets in the way and for shaping actions",
    "Learning connected to your focus area",
  ],
};

export const OFFERS: Offer[] = [
  {
    key: "clarity",
    name: "Aligned Clarity",
    tagline: "See where you stand. Choose what matters next. Build a practical plan.",
    price: "Free",
    priceNote: "Always",
    short: "Your Next Step, Today and your journal",
    includes: [
      "The ten-area Aligned audit and your Alignment Map",
      "Your notes on every area",
      "The Next Step: five guided parts, with Duane’s guidance",
      "Today on My Space: your moves, ready to tick off",
      "A weekly check-in, and a rescore when your Next Step is taken",
      "Your private journal",
      "Your progress and history in one place",
    ],
  },
  {
    key: "momentum",
    name: "Aligned Momentum",
    tagline: "A weekly appointment with what matters.",
    price: "£99",
    pricePence: 9900,
    per: "a month",
    priceNote: "Live, weekly · cancel any time",
    short: "A live weekly hour with a small group, and the daily practice",
    intro: "Everything in Clarity, plus:",
    includes: [
      "A live group hour on Zoom every week, Sundays at 6pm (UK time)",
      "Facilitated by Duane or an approved Aligned facilitator",
      "Review your week, reflect on what helped or got in the way, and adjust your plan",
      "Leave with a commitment you can see in My Space",
      "Speak, use the chat, or take part quietly",
      "The full daily practice: morning audio, intention, evening reflection and tools",
    ],
    featured: true,
  },
  {
    key: "focus",
    name: "Aligned Focus",
    tagline: "Your situation. Four focused coaching sessions. Twelve weeks of visible action.",
    price: "£995",
    priceNote: "12-week programme · one payment",
    short: "Twelve weeks with an Aligned Coach",
    intro: "Everything in Momentum for 12 weeks, plus:",
    includes: [
      "Four 60-minute one-to-one coaching sessions",
      "Starts from your audit, Alignment Map and Next Step",
      "Agreed actions and a written summary after every session",
      "Clearly bounded feedback between sessions",
      "Your accountability, visible in My Space",
      "A closing review and rescore, and a decision about what comes next",
    ],
  },
];

// Aligned Focus, session by session.
export const FOCUS_SESSIONS: [string, string][] = [
  ["Clarify and sharpen", "Confirm what matters, refine your Next Step and agree the first actions."],
  ["Work through the obstacle", "Review what happened, find what’s getting in the way and adjust the route."],
  ["Build evidence and accountability", "Look at your progress, strengthen follow-through and make the next commitment visible."],
  ["Review and continue", "Rescore the area, see what changed and decide what comes next."],
];

// The hour, for Momentum: [label, minutes].
export const MOMENTUM_HOUR: [string, number][] = [
  ["Arrive", 5],
  ["Review", 10],
  ["Reflect", 15],
  ["Adjust", 10],
  ["Commit and questions", 15],
  ["Close", 5],
];

export const offerFor = (key: Offer["key"]) => OFFERS.find((o) => o.key === key)!;

// A membership's name, including any older Practice membership.
export const tierName = (tier: "practice" | "momentum") => (tier === "practice" ? PRACTICE.name : offerFor("momentum").name);

// While joining is switched off: an email to ask.
export function joinHref(o: Offer) {
  const subject = o.key === "focus" ? "Aligned Focus: I’d like to start" : `${o.name}: I’d like to join`;
  return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}`;
}
