// Words for the public homepage and the free-profile step, kept in one place
// so they can be edited without touching the page code.

export const SITE = {
  name: "Aligned",
  url: "https://www.the-aligned.com",
  contactEmail: "hello@the-aligned.com",
  title: "Aligned — see where you stand and choose what matters next",
  description:
    "Ten honest questions about where your life stands today. See your snapshot, choose one area to focus on, and turn it into an action you can practise and review. Free.",
};

export const HERO = {
  promise: "See where you stand. Choose what matters next.",
  promiseTail: "Turn it into an action you can practise and review.",
  audience:
    "For people juggling work and everything else, who feel pulled in several directions and want their choices to reflect what matters to them.",
  support: "Ten honest questions. One clear starting point.",
  small: "Free · about ten minutes · no account needed to start",
};

// The worked example on the homepage. Fictional on purpose: it must never
// read like a real person's result or a testimonial.
export const EXAMPLE = {
  scores: [7, 6, 6, 7, 6, 5, 6, 4, 6, 7],
  focusIndex: 7, // Daily Structure & Discipline
  focusScore: 4,
  stepUp: "Five would mean making room for one priority.",
  action: "On Monday at 9am, spend 20 minutes planning the week’s priority.",
  review: "At the goal check-in: did it happen? Keep it, adjust it, or mark it done.",
};

export const HOW = [
  { title: "See where you stand", text: "Score ten areas of your life as they feel today, with notes in your own words. You get a snapshot straight away." },
  { title: "Choose a focus", text: "Pick one area to start with. Then describe what one point better would look like — not a complete fix, one honest step up." },
  { title: "Plan and act", text: "CLEAR, five short questions, turns that into one action, when you’ll do it, and what “done” looks like." },
  { title: "Review", text: "A monthly goal check-in records what happened, so you can keep going, adjust or move on. Revisit all ten areas every few months." },
];

// Set approved: true once Duane has supplied his own introduction. Until
// then the section is clearly marked as a draft.
export const ABOUT_DUANE = {
  approved: false,
  heading: "A welcome from Duane",
  paragraphs: ["Awaiting Duane’s approved introduction: three to five sentences in his own words."],
};

// The free-profile offer, word for word on the homepage, the results page
// and the registration page.
export const PROFILE_OFFER = {
  heading: "Keep your starting point. Build your next step.",
  points: [
    "Keep your snapshot and personal notes together.",
    "Turn your chosen focus into a practical CLEAR plan.",
    "Return to your plan and review what happened.",
  ],
  button: "Create my free profile",
  next: "Next, we’ll help you build your first plan.",
};

export const AFTER_REGISTERING = [
  "Confirm your email with one click.",
  "Your snapshot, notes and starting point are already there.",
  "Build your first plan with CLEAR — five short questions.",
  "Act on it, then check in and review what happened.",
];

export const FAQS = [
  { q: "Is it free?", a: "Yes. The audit and your profile are free." },
  { q: "How long does it take?", a: "About ten minutes for the audit. Building your first plan takes about ten more, whenever you’re ready." },
  { q: "Do I need an account?", a: "Not to start. You see your full snapshot first, then choose whether to keep it in a free profile." },
  {
    q: "What do the scores mean?",
    a: "They’re your own reflection of how each area feels today, from 1 to 10. They aren’t a diagnosis, a ranking or a test, and a low score isn’t a failure — it’s a place you might choose to start.",
  },
  {
    q: "Who can see my answers?",
    a: "Your answers are private to your account. If you choose to work with Duane as your coach, Duane can see your audit and plan to support you. Private reflections stay private.",
  },
  { q: "What if I stop halfway?", a: "Your answers save as you go. Come back on the same device and you’ll carry on where you left off." },
];
