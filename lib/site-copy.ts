// Words for the public homepage and the free-profile step, kept in one place
// so they can be edited without touching the page code.

export const SITE = {
  name: "Aligned",
  url: "https://www.the-aligned.com",
  contactEmail: "hello@the-aligned.com",
  owner: "Aligned",
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
  review: "At the weekly review: did it happen? Keep it, make it smaller, or change it.",
};

export const HOW = [
  { title: "See where you stand", text: "Score ten areas of your life as they feel today, with notes in your own words. You get a snapshot straight away." },
  { title: "Choose a focus", text: "Pick one area to start with. Then describe what one point better would look like — not a complete fix, one honest step up." },
  { title: "Plan and act", text: "Five guided steps turn that into one clear action, when you’ll do it, and how you’ll know it’s helping." },
  { title: "Review", text: "A one-minute weekly review keeps it going: keep it, make it smaller or change it. Every month, score the area again; every few months, revisit all ten." },
];

// Set approved: true once Duane has approved the wording. Until then the
// live site shows his photo but not the text; previews show the text marked
// as a draft. Drafted only from Duane's own words on duanebryan.com/about.
export const ABOUT_DUANE = {
  approved: true, // approved by Duane, 19 October 2026
  heading: "A welcome from Duane",
  paragraphs: [
    "I help people get clear, get aligned and move forward, because I know what it feels like to look like you’re holding it together on the outside while knowing something has to change on the inside.",
    "At 42, after businesses and relationships had fallen apart, I decided to change my life properly: not perform change, live it. At 43 I went back to university to study psychology at master’s level, to put language to what I’d been living.",
    "The Aligned Protocol is what came out of that. Supportive, but not soft. Clear, but not cold. Not motivation: evidence.",
  ],
  // "Read Duane's story", opened on the homepage itself.
  story: [
    "There was a point where everything I had built on the outside no longer matched what I felt on the inside. Businesses had failed. Relationships had failed. I had lost parts of my identity, and I was tired of pretending I was fine.",
    "When I needed to change my mind, I started with my body. I stopped drinking. I got clean. I changed my routine. I trained properly — using my body as the first place to build evidence that I could follow through on what I said I wanted.",
    "If I was going to tell people they could turn things around, I had to look at my own obstacles first: drinking, co-dependency, mental health, old relationship patterns and the ways I got in my own way. That became part of the foundation for the Aligned Protocol.",
    "Going back to study psychology gave language to things I had always felt: overthinking, emotional regulation, identity, behaviour and change. I’m not interested in theory for its own sake — only the kind of insight that helps you take the next step.",
  ],
  photo: { src: "/media/duane/duane-portrait.jpg", width: 900, height: 1350, alt: "Duane Bryan, smiling, sitting outside at a table with his laptop" },
};

// The privacy policy and terms on this site (/privacy, /terms). Drafts until
// Duane (ideally with a solicitor) approves them: previews show them marked
// as drafts; the live site hides them and their footer links.
export const LEGAL = {
  approved: false,
  updated: "October 2026",
};

// The free-profile offer, word for word on the homepage, the results page
// and the registration page.
export const PROFILE_OFFER = {
  heading: "Keep your starting point. Build your next step.",
  points: [
    "Keep your snapshot and personal notes together.",
    "Turn your chosen focus into a practical plan, in five guided steps.",
    "Return to your plan and review what happened.",
  ],
  button: "Build my free plan",
  next: "Build your plan first, then save it to a free account.",
};

export const AFTER_REGISTERING = [
  "Build your plan in five guided steps, before you sign up.",
  "Save it to a free account, and confirm your email with one click.",
  "Your snapshot, plan and notes are kept together.",
  "Act on it, then a one-minute weekly review keeps it going.",
];

export const FAQS = [
  { q: "Is it free?", a: "Yes. The audit and your profile are free." },
  { q: "How long does it take?", a: "About ten minutes for the audit. Building your first plan takes about ten more, whenever you’re ready." },
  { q: "Do I need an account?", a: "Not to start. You see your snapshot and build your plan first, then save it in a free account." },
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
