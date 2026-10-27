import { SITE } from "./site-copy.ts";

// What Aligned offers, at founding prices (Aligned: the journey and the
// offers, October 2026). Working names. Prices are the total the customer
// pays; no VAT is charged while Aligned isn't VAT-registered.
//
// Memberships can't be bought on the site yet (Stripe subscriptions come
// next), so each paid offer's button asks to join the founding list by email.

export type Offer = {
  key: "clarity" | "practice" | "momentum" | "focus";
  name: string;
  tagline: string;
  price: string;
  per?: string;
  priceNote: string;
  short: string; // one line, for Your plan is set
  intro?: string; // "Everything in …, plus:"
  includes: string[];
  pilot?: boolean;
  featured?: boolean;
};

export const OFFERS: Offer[] = [
  {
    key: "clarity",
    name: "Aligned Clarity",
    tagline: "See what needs your attention. Know where to begin.",
    price: "Free",
    priceNote: "Always",
    short: "Your plan, weekly reviews and monthly review",
    includes: [
      "Ten-area audit and your snapshot",
      "Build your plan in five guided steps, with Duane’s video guidance",
      "Your dashboard, saved plan and next action",
      "Weekly review and monthly review",
      "Your progress and past reviews in one place",
    ],
  },
  {
    key: "practice",
    name: "Aligned Practice",
    tagline: "Give what matters a place in your everyday life.",
    price: "£9",
    per: "a month",
    priceNote: "Founding price · self-guided",
    short: "Daily Alignment, reflection and tools",
    intro: "Everything in Clarity, plus:",
    includes: [
      "Daily Alignment: a morning intention and an evening reflection",
      "Values, identity and direction exercises",
      "Tools for what gets in the way and for shaping actions",
      "Learning for your area, and your saved reflections",
    ],
  },
  {
    key: "momentum",
    name: "Aligned Momentum",
    tagline: "An hour for you. A commitment you return to.",
    price: "£25",
    per: "a month",
    priceNote: "Founding price · live, weekly",
    short: "A live weekly hour with a small group",
    intro: "Everything in Practice, plus:",
    includes: [
      "A live hour on Zoom every week, at the same time",
      "Facilitated by Duane or an Aligned facilitator",
      "Review your week and set your next commitment, alongside others",
      "Speak, use the chat, or keep it as quiet reflection time",
    ],
    pilot: true,
    featured: true,
  },
  {
    key: "focus",
    name: "Aligned Focus",
    tagline: "Your situation. A coach in your corner.",
    price: "£995",
    priceNote: "Six-week programme · one payment",
    short: "Six weeks with an Aligned Coach",
    includes: [
      "Three 60-minute one-to-one sessions with an Aligned Coach",
      "A clear beginning, working period and closing review",
      "Agreed actions and a summary after every session",
      "A set amount of feedback between sessions",
      "Practice and Momentum included for the six weeks",
    ],
  },
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

// Until paid offers can be bought on the site: a founding-list email.
export function joinHref(o: Offer) {
  const subject = o.key === "focus" ? "Aligned Focus: I’d like to start" : `${o.name}: founding place`;
  return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}`;
}
