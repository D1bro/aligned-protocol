// Learn content: Academy paths, Musings and Tools. Plain data so Duane's
// wording can be edited in one place. Everything marked `draft: true` is a
// starting draft for Duane to rewrite in his own voice (or record as video:
// set `video` to a clip URL and its poster).

import type { GuideClip } from "@/lib/audit-guides";

export type Video = { src: string; poster: string | null; captions?: string | null } | null;

export type Lesson = {
  slug: string;
  title: string;
  // Estimated, at a calm pace. Confirm once each recording exists.
  minutes: number;
  summary: string;
  // The read-aloud script, so the lesson works before the video is recorded.
  body: string[];
  reflection: string;
  action: string;
  // Optional links: a Tools exercise, or the ten areas guide.
  tool?: string;
  guide?: "ten-areas";
  video: Video;
  draft: boolean;
};

export type Path = { slug: string; title: string; promise: string; lessons: Lesson[] };

export const ACADEMY_INTRO =
  "The Academy helps you understand what your audit is showing you and put your plan into practice. Start with Clarity and Direction: four short lessons to see where you are, choose a focus, understand why it matters and take one useful step. Learn at your own pace, then bring what you discover into your plan.";

export const PATHS: Path[] = [
  {
    slug: "clarity-and-direction",
    title: "Clarity and Direction",
    promise: "See where you are, choose a focus, understand why it matters and take one useful step.",
    lessons: [
      {
        slug: "seeing-where-you-are",
        title: "Seeing where you are",
        minutes: 5,
        summary: "Your scores are information, not a verdict.",
        body: [
          "Right. You’ve answered the ten questions. Before you rush into fixing anything, I want you to take a moment to look at what you’ve actually said.",
          "Because there can be a difference between the life we’re getting through every day and the life we would describe if we stopped and looked at it properly. You can be busy, capable, getting things done, and still have an area that feels off. The audit gives you somewhere to begin that conversation with yourself.",
          "Look at your snapshot as a whole. Where do things feel steady? Where do they feel stretched? And which score surprised you? It might be lower than you expected. It might be higher. Perhaps you’ve been so focused on what’s difficult that you’ve overlooked something you’re actually looking after well.",
          "We’ve broken this down into ten areas because saying my whole life feels out of alignment can be overwhelming. Looking at health, relationships, work, money or daily structure gives us something more specific to understand. These areas connect. A difficult week at work can affect your sleep. Poor sleep can affect how much patience you have in a conversation. We’re giving those experiences names so you can see where to look more closely.",
          "A score is the beginning of that explanation. Say you’ve given health and energy a four. What does that four mean in your actual week? Are you sleeping badly? Have you stopped moving? Are you eating on the go? Or are you managing a health problem that needs support? The number alone cannot tell us that. Your notes help us understand what’s behind it.",
          "So answer from where you are now. Keep the same scale in mind: one is completely out of alignment, and ten is fully aligned with how you want to live in that area. You don’t need to defend a low score, and you don’t need to mark yourself down to prove you’re being honest. Try to give yourself a fair picture.",
          "If you see something difficult, notice it without turning it into a statement about who you are. I’ve let my routine slip gives you something to work with. I never follow through closes the conversation before it’s begun. And if an area is working, notice what is helping. There may be something there you want to protect or carry into another part of your life.",
          "I know from my own experience that doing well in one area doesn’t automatically mean you’re living in the direction you want. I was working and doing well, but it wasn’t what I actually wanted to be doing. Being honest about that gave me something much more useful than another achievement in the same direction.",
          "For you, it might be quieter than that. You may simply notice that you have no time for yourself, or that a relationship needs attention, or that you don’t know what you’re working towards. You don’t have to solve it all while you’re looking at the page. First, let yourself see it.",
          "Now read the notes beneath the score that stood out. Which sentence feels most true? It could be a frustration, something that’s working, or something you’ve been putting off saying. Write that down in your own words.",
          "Then answer the question beneath this lesson: which score surprised you most, and why? A couple of honest sentences are enough. If none surprised you, say which score feels most important to understand and why.",
          "That’s our starting point. Once you can see where you are, you can begin to choose where your attention goes next.",
        ],
        reflection: "Which score surprised you most, and why?",
        action: "Re-read the relevant audit note and identify the sentence that best explains the score.",
        guide: "ten-areas",
        video: null,
        draft: true,
      },
      {
        slug: "choosing-one-place-to-start",
        title: "Choosing one place to start",
        minutes: 5,
        summary: "One area, given proper attention, can move you further than ten changes you cannot keep up with.",
        body: [
          "Right. You’ve got the picture in front of you. Now we need to decide where to start.",
          "This is the point where it’s tempting to write ten new goals. Sort the sleep out. Get the money right. Improve the relationship. Change the work. Find the confidence. You can see what needs attention, and suddenly it feels as though everything needs your attention today.",
          "But look at the time and energy you actually have. If we spread that across ten different changes, it can become difficult to give any one of them enough attention to understand what’s working. So we’re going to choose one place to begin. One area, given proper attention, can move you further than ten changes you cannot keep up with.",
          "That doesn’t mean the other areas stop mattering. It means we’re making a decision about where your effort will be most useful first.",
          "Often, the lowest score is a good place to look. If you’ve given an area a three, there is probably something there worth understanding. But you still need to ask why. Is it something you can influence now? Is there a practical change available? Or does it need a different kind of support?",
          "And sometimes a different area is holding several others back. Imagine your daily structure is a four. You’re constantly reacting to messages, work and whatever comes up. You want to move your body, speak to people you care about and work on your own plans, but none of it gets a place in the day. A small change to your structure may give those other areas a better chance.",
          "Or perhaps money is taking up so much mental space that you’re struggling to switch off. Getting clearer about that situation might help you feel less scattered when you work or spend time with someone. These are possibilities to explore. We won’t assume one change will solve everything.",
          "What we’re looking for is a useful connection. If this area became one point better, what else might become easier?",
          "Then think about what one point means. If relationships are at a four, a five might mean you have one honest conversation you’ve been avoiding. If daily structure is at a five, a six might mean you’ve protected a small amount of time for something important. Give it a meaning you can recognise in your own life.",
          "If two areas are asking for attention, you can acknowledge both. Choose one as your working focus, and keep the other in view. You haven’t abandoned it. You’re giving yourself a way to begin without being pulled in every direction.",
          "You also don’t need to choose the most impressive change. Choose the area you can explain honestly, that matters to you, and where you can identify a useful next step. You are allowed to start somewhere manageable.",
          "So write the area you’re choosing. Then finish this sentence: I’m starting here because…",
          "Try to go further than because it’s my lowest score. Tell yourself what is happening there and what you hope a change would make possible. That reason will help you when the initial motivation wears off.",
          "If you’ve already chosen a focus in your plan, use this lesson to check it. Does it still make sense? Keep it if it does. If it doesn’t, review it deliberately rather than adding another goal beside it.",
          "You’re choosing where to direct your attention. That is a useful kind of agency: understanding the situation and deciding what you’re going to work on first.",
        ],
        reflection: "If this area moved one point, what else would get easier?",
        action: "Name one focus and write why it is your starting point.",
        video: null,
        draft: true,
      },
      {
        slug: "what-matters-here",
        title: "What matters here",
        minutes: 6,
        summary: "Direction comes from what you value, not what you think you should want.",
        body: [
          "Right. You’ve chosen an area. Now I want us to understand why it matters to you.",
          "Because you can choose a goal that sounds good and still feel no real connection to it. You might want the job, the relationship, the income or the lifestyle because it looks like what you’re supposed to want. But when it comes to making room for it in your life, you find yourself asking whether you even want to be doing it.",
          "A goal borrowed from someone else can be difficult to keep. A goal connected to what matters to you gives you a reason you can come back to. You’ll still have difficult days. It simply helps you understand why the effort is worth making.",
          "So take the area you’ve chosen and ask: if this were working better, what would it give me?",
          "Perhaps money and stability would give you some breathing room. You could make decisions with a clearer understanding of your commitments. Perhaps career and work would give you a way to contribute that feels meaningful. Perhaps relationships would give you more honesty, warmth or connection. Perhaps looking after your body would give you the energy to be present for the people and activities you care about.",
          "Try to look underneath the first answer. If you say I want more money, ask what it would make possible. If you say I want confidence, ask what you would feel more able to do. If you say I want a relationship, ask what kind of relationship you want to participate in and how you want to show up within it.",
          "This brings us to values. Your values are the qualities and directions you want to live by. Connection. Integrity. Freedom. Care. Growth. Peace. You get to decide what those words mean to you. They might have been influenced by your family or your experiences, but you can still choose whether they belong in your life now.",
          "A value gives direction. A goal gives you something specific to work towards. If you value connection, the goal might be to make regular time for someone you care about. If you value integrity, the action might be having an honest conversation rather than making a promise you don’t intend to keep.",
          "Be careful with words that sound good but never reach your everyday life. What does peace look like on a Tuesday? What does authenticity sound like in a conversation? What would someone see you doing if you were practising that value?",
          "For me, doing well at work wasn’t enough when the direction wasn’t what I wanted. I had to look at what mattered beyond being successful at something. That helped me understand why changing direction was important. Your answer might lead to a change, or it might help you appreciate and strengthen something you already have.",
          "And your circumstances matter. You might value time with family and still need to work long hours. That doesn’t make the value false. It asks us to find an action that fits the life you are in. There may be a small, realistic way to honour it while you work towards a bigger change.",
          "Now finish the sentence: when this area is working better, I can…",
          "Then ask whether that answer feels like yours. Would it still matter if no one applauded it? What value sits underneath it? And how does it connect to the person you want to become?",
          "Write your answer beneath the lesson. We need enough clarity to choose the next step with a reason behind it. You can keep learning about that reason as you move.",
        ],
        reflection: "Why does this area matter to you, not to anyone else?",
        action: "Name the value beneath your goal and describe what it would look like in everyday behaviour.",
        tool: "values",
        video: null,
        draft: true,
      },
      {
        slug: "from-clarity-to-one-step",
        title: "From clarity to one step",
        minutes: 6,
        summary: "Picture the ten if it helps, then plan for the next point up.",
        body: [
          "Right. We can see where you are. You’ve chosen a focus, and you understand why it matters. Now we need to turn that into something you can actually do.",
          "It’s easy to picture the finished version. The confident person. The stable finances. The relationship that feels connected. The routine that runs smoothly. That picture can help you understand the direction. But you still need to know what you’re doing this week.",
          "So picture the ten if it helps, then plan for the next point up.",
          "If this area is a four, what would a five look like in your actual life? Try to describe something you could recognise. More clarity about a decision. A conversation you’ve been avoiding. Time protected for yourself. A process completed. Something that makes the area work a little better for you.",
          "Then ask which part is within your control. You can choose to prepare for a conversation and speak honestly. You cannot guarantee how the other person responds. You can set time aside and complete a piece of work. You cannot guarantee an immediate sale or an outside opportunity. Build the action around what you can do, and review the outcome separately.",
          "Let’s use daily structure as an example. I want to be more disciplined is a direction, but it doesn’t tell you what to do. On Sunday at six, I’ll spend ten minutes planning the three things that need a place in my week gives you an action, a time and a way to know you’ve done it.",
          "And make it realistic. A good step is small enough to attempt in a difficult week and specific enough that you can recognise completion. That doesn’t mean it has to be effortless. It means you’re giving it a fair chance to happen.",
          "Perhaps your ideal version is an hour of movement, but your first step is ten minutes. Perhaps you want to organise every part of the business, but this week you’re finishing one part of the process. Choose the step that helps you begin and gives you something useful to learn from.",
          "Now look at what might get in the way. If work runs late, what is the smaller version? If you miss the planned time, when can you return to it? Decide this before the week gets difficult. For example: if Sunday evening gets taken over, I’ll do the ten-minute plan on Monday before I open my messages.",
          "You can be clear about your intention without treating every missed action as a failure of identity. Ask what happened. Was the step too large? Was the time unrealistic? Did you need information or support? Adjusting a plan after you’ve tried it is part of following through.",
          "Your action may help the score improve, but the number is not the only evidence. You might have completed useful work while circumstances got harder. You might be more honest in your next audit. Notice what you did, what you learnt and how the area feels.",
          "Write the next step in one sentence: I will do this action, at this time, and I’ll know I’ve done it when…",
          "If you already have a plan, open it and check that sentence against what you’ve saved. Refine it if needed. If you haven’t created the plan yet, take this answer into Build your plan. Keep your work connected rather than making another goal somewhere else.",
          "Then give the action a place in your week. You can come back to review it before the next full audit. You don’t have to wait three months to learn from what happened.",
          "Alignment is the foundation. Action is the transformation. This is where your clarity begins to become something you practise.",
        ],
        reflection: "What would one point better look like this month?",
        action: "Confirm one specific step, when it happens, what counts as done and an if-then response to an obstacle.",
        tool: "action-planner",
        video: null,
        draft: true,
      },
    ],
  },
];

// Duane's Musings. Personal experiences are only those Duane supplied;
// `note` marks illustrative examples or what a piece is not.
export type Musing = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  question: string;
  note: string;
  tool?: string;
  video: Video;
  draft: boolean;
};

export const MUSINGS: Musing[] = [
  {
    slug: "doing-well-and-wanting-more",
    title: "Doing well, and still wanting something different",
    summary: "On the quiet gap between how things look and how they feel.",
    body: [
      "Something I’ve been thinking about is how difficult it can be to admit you want something different when things look as though they’re going well.",
      "You’re working. You’re capable. You might be earning well or getting recognised. And people can look at your life and think you’ve got it sorted. But you can still have this quiet feeling that the direction isn’t right for you.",
      "I know that feeling. There was a point where I was doing well at work, but I wasn’t doing what I actually wanted to do. I could achieve more in that same direction, and it still wouldn’t answer the question I was avoiding: is this how I want to live?",
      "That can be difficult to sit with. You’ve invested time. You have responsibilities. Maybe the people around you are proud of what you’re doing. So you tell yourself to get on with it, or you assume another achievement will make the feeling go away.",
      "But perhaps the feeling is worth listening to before you decide what it means. It might be asking for a different direction. It might be asking for more space outside work. It might be showing you that something important has been squeezed out of your life.",
      "You don’t need to make a dramatic decision just because you’ve noticed it. You can begin by being specific. What is working? What do I want to keep? And what part of this life doesn’t feel like mine anymore?",
      "For me, that is where alignment becomes useful. It gives you a way to look at the gap between how things appear and how you’re experiencing them. You can appreciate what you have and still be honest about what needs attention.",
      "Then think about a small change you could explore. Have a conversation. Protect some time. Learn about the direction you’re interested in. You can investigate what matters without pretending you already know the whole answer.",
    ],
    question: "Where is there a gap between how your life looks and how it feels? And if you gave that gap a little attention, what might you discover?",
    note: "",
    video: null,
    draft: true,
  },
  {
    slug: "reconnecting-with-your-values",
    title: "Reconnecting with your values",
    summary: "Finding direction again by asking what still matters, and where it has a place in your choices.",
    body: [
      "Values are something I want to talk about because, for me, they’ve become a way of finding direction again.",
      "When I was younger, I felt clear about what mattered to me. Family. Connection. Love. Peace. Integrity. Agency. Authenticity. Those words meant something in how I wanted to live and relate to people.",
      "Then I went through a difficult relationship. When it ended, I didn’t immediately recognise how far I’d moved away from some of those values. I knew I was hurt, but I didn’t have the language to understand what that was doing to the way I connected afterwards.",
      "The relationships that followed struggled. I became emotionally unavailable. I could still want connection, but I wasn’t always showing up in a way that made it possible. Looking back, I can see that I had lost touch with parts of what mattered to me.",
      "What has helped me is being able to ask: what do I actually value now? Which of those earlier values still feel true? And where have my choices stopped reflecting them?",
      "That gives me a different place to choose from. If I value connection, I can ask what kind of connection I want and what I’m prepared to bring to it. If I value peace, I can think about how I handle conflict and what boundaries I need. If I value authenticity, I can notice where I’m agreeing to something that doesn’t feel honest.",
      "Your values belong to you. Some may have come from family, culture or relationships and still feel right. Others may be expectations you’ve carried without choosing them. You’re allowed to examine them. You’re also allowed to change as you learn more about yourself.",
      "So reconnecting doesn’t have to mean returning to exactly who you were before something painful happened. It can mean recognising what you still want to carry forward, and choosing how to live by it now.",
      "Let me give you an everyday example. Someone says they value family, but every evening gets swallowed by work. That person may care deeply about family. The question is where that value has a place in the life they’re living. Another person values integrity but keeps saying yes because they don’t want to disappoint anyone. They may need a more honest answer, including an honest no. These are examples to reflect on, rather than judgements about people.",
      "And in relationships, this becomes a useful question: do the connections I’m pursuing reflect what matters to me? If I want honesty, warmth and mutual respect, am I looking for those qualities? Am I practising them? Or am I accepting whatever is available because I haven’t stopped to decide what I want?",
      "Having clear values doesn’t make every choice easy. You can value connection and still need a boundary. You can value freedom and still have commitments. But you have something to think with when you make the decision.",
      "Choose three values that feel like yours today. Write what each one means in ordinary life. Then look at the area you’re working on. What is one choice you could make this week that would honour one of those values?",
      "For me, that connection has given me a sense of agency. I can look at a choice and ask whether it’s taking me towards the kind of life I want to participate in.",
    ],
    question: "What matters to me, and where does it have a place in my actual choices?",
    note: "The everyday examples in this piece are illustrative, not about real people.",
    tool: "values",
    video: null,
    draft: true,
  },
  {
    slug: "emotional-availability",
    title: "Emotional availability",
    summary: "What happens when a feeling or a need enters a relationship.",
    body: [
      "Emotional availability is a phrase we hear, but I think it’s worth asking what we actually mean by it.",
      "For this conversation, I mean being able to notice something of what you feel, communicate it honestly, and make room for another person’s feelings too. That might look different from one person or relationship to another. It doesn’t require you to be expressive all the time, or tell everyone everything.",
      "You can have boundaries and still be emotionally available. You can need a pause and still be willing to come back to a conversation. The useful question is what happens when a feeling or a need enters the relationship.",
      "Imagine someone you care about says, I’ve been feeling distant from you. You may hear that as criticism. You might feel defensive, want to make a joke, change the subject or disappear into work. That’s an example of a response to notice. It doesn’t, on its own, tell us everything about you or the relationship.",
      "But if that response keeps happening, it’s worth asking what you find difficult about the conversation. Can you name what you felt? Can you hear what the other person is saying? Can you explain that you need a moment and agree when you’ll return?",
      "Emotions can give us clues about what matters and how we’re experiencing a situation. They don’t always tell us the whole story. Feeling fear doesn’t automatically mean the person in front of you is dangerous. Feeling angry doesn’t automatically mean your first interpretation is right. We can take the feeling seriously and still look at what happened.",
      "Sometimes we have learnt to keep feelings to ourselves. Sometimes past hurt makes openness difficult. Sometimes we’re exhausted, overwhelmed or with someone we don’t feel able to trust. There isn’t one cause, and being quiet is not the same as being unavailable. Context matters.",
      "An emotionally open response might be: I can hear that this matters. I’m feeling defensive and I need a little time to understand it. Can we come back to this tonight? Then the important part is actually returning. You’re being honest about your capacity and making room for the conversation.",
      "The other person’s response matters too. If your feelings are mocked or repeatedly dismissed, more disclosure isn’t automatically the answer. Openness needs discernment about who you trust and what feels appropriate to share.",
      "So rather than asking for a single number that tells you whether you’re emotionally available, look at a few real moments. Do I recognise what I’m feeling? Can I express a need without making someone guess? Can I listen without immediately correcting their experience? When I take space, do I return? Can I admit when I’ve got something wrong and try to repair it?",
      "Those are reflection questions, not a diagnosis or a label to give your partner. If you notice a pattern, choose one small thing to practise. Name the feeling more clearly. Ask one curious question. Return to a conversation you said you’d return to. If the pattern feels distressing or hard to shift, you can choose to talk it through with a qualified professional.",
      "You don’t have to force yourself into openness. You can begin by understanding what happens for you, with someone you trust and at a pace you can manage.",
    ],
    question: "When connection asks something of me emotionally, what do I tend to do next?",
    note: "A reflection, not a test or a diagnosis. The relationship example is illustrative. If a pattern feels distressing or hard to shift, you can choose to talk it through with a qualified professional.",
    video: null,
    draft: true,
  },
];

// The Aligned Podcast. Set `audio` to an MP3 URL (or `video` to an MP4) when an
// episode is recorded; until then the page shows "Coming soon".
export type Episode = {
  slug: string;
  number: number;
  title: string;
  summary: string;
  minutes: number | null;
  notes: string[];
  question: string;
  audio: string | null;
  video: Video;
  draft: boolean;
};

export const EPISODES: Episode[] = [
  {
    slug: "what-alignment-means",
    number: 1,
    title: "What alignment actually means",
    summary: "Why the Aligned Protocol starts with a snapshot, not a strategy.",
    minutes: null,
    notes: [
      "What we mean by alignment: how closely the way you live matches what matters to you.",
      "Why the audit is a reflection, not a diagnosis — and why honesty beats a high score.",
      "Alignment is the foundation; action is the transformation.",
    ],
    question: "Which part of your life feels most in line with who you are right now?",
    audio: null,
    video: null,
    draft: true,
  },
  {
    slug: "one-step-at-a-time",
    number: 2,
    title: "One step at a time",
    summary: "Why one goal, done properly, beats a list of ten.",
    minutes: null,
    notes: [
      "Why the plan focuses on one area and the next point up, not a perfect 10.",
      "What makes a step small enough to do on a bad week.",
      "How weekly and monthly reviews keep the step honest.",
    ],
    question: "What’s the smallest step that would still feel like progress this month?",
    audio: null,
    video: null,
    draft: true,
  },
];

export type ToolPrompt = {
  key: string;
  label: string;
  placeholder: string;
  rows?: number;
  // Starts a new titled section (with an optional line of guidance).
  section?: string;
  sectionIntro?: string;
  // An optional section starts folded away until the member opens it.
  optional?: boolean;
};

export type Tool = {
  slug: string;
  title: string;
  purpose: string;
  intro?: string;
  prompts: ToolPrompt[];
  // Shown after the prompts.
  closing?: string;
};

const valuePrompts = (n: number): ToolPrompt[] => [
  {
    key: `v${n}_value`,
    label: "My value is…",
    placeholder: "",
    rows: 1,
    section: `Value ${n}`,
    optional: n > 1,
    sectionIntro:
      n === 1
        ? "Example: Connection means giving attention and being honest with someone I trust. This week, I will invite them for a phone-free conversation. My boundary is making room for both people to speak, rather than being available for every request."
        : undefined,
  },
  { key: `v${n}_means`, label: "In my words, this means…", placeholder: "", rows: 2 },
  { key: `v${n}_mine`, label: "I know it feels like mine because…", placeholder: "", rows: 2 },
  { key: `v${n}_looks`, label: "In everyday behaviour, it looks like…", placeholder: "", rows: 2 },
  { key: `v${n}_recent`, label: "One recent choice that supported it was…", placeholder: "", rows: 2 },
  { key: `v${n}_room`, label: "One place it needs more room is…", placeholder: "", rows: 2 },
  { key: `v${n}_boundary`, label: "A boundary that helps me honour it is…", placeholder: "", rows: 2 },
  { key: `v${n}_action`, label: "One action I can choose this week is…", placeholder: "", rows: 2 },
];

export const TOOLS: Tool[] = [
  {
    slug: "values",
    title: "Values reflection",
    purpose: "Name what matters to you, in your own words, and give it a place in your week.",
    intro:
      "Take five to ten minutes. Use experiences you feel comfortable considering; you do not need to revisit painful details to complete this exercise.",
    prompts: [
      {
        key: "words",
        label: "What qualities mattered in those moments?",
        placeholder: "Your own words",
        rows: 3,
        section: "Find your own words",
        sectionIntro:
          "Think of a time when you felt proud of how you behaved, a time when something important felt missing, and a choice you keep returning to. Possible starting words: connection, care, integrity, freedom, learning, creativity, stability, courage, family, peace and authenticity. Choose your own words rather than treating this as a required list.",
      },
      ...valuePrompts(1),
      ...valuePrompts(2),
      ...valuePrompts(3),
      {
        key: "plan_because",
        label: "This focus matters to me because it helps me live with more…",
        placeholder: "",
        rows: 2,
        section: "Bring it into your plan",
        sectionIntro: "Your answers stay here. Compare your next action with My plan and refine the plan yourself if it helps; nothing is changed for you.",
      },
      { key: "plan_become", label: "I want to become someone who…", placeholder: "", rows: 2 },
      { key: "plan_action", label: "My next action is…", placeholder: "", rows: 2 },
      {
        key: "plan_tension",
        label: "If two values pull in different directions, name both and a workable response.",
        placeholder: "Connection and peace: an honest conversation, with a clear boundary",
        rows: 2,
      },
    ],
    closing: "There is no correct score or pass mark for this exercise. After you try the action, come back and note what you learnt.",
  },
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

// "Understanding your ten areas": an optional guide, not a required step.
export const TEN_AREAS_INTRO = [
  "Saying “my whole life feels out of alignment” can be overwhelming. Looking at ten areas gives you something more specific to reflect on: where things feel steady, where they feel stretched, and where to look more closely.",
  "The ten areas are a practical way of organising your reflection. They aren’t ten separate boxes, a diagnosis, or a claim to capture everything about your life. They overlap: a hard week at work can affect your sleep, and poor sleep can affect your patience with people you care about. If something runs across several areas, say so in your notes.",
];

export const TEN_AREAS: { name: string; focus: string; distinction: string }[] = [
  { name: "Health & Energy", focus: "Physical care", distinction: "Sleep, movement, nutrition, health and available energy" },
  { name: "Mindset & Thinking", focus: "Thought patterns", distinction: "Beliefs, self-talk and interpretation of challenges" },
  { name: "Confidence & Self-Belief", focus: "Trust in capability", distinction: "Being seen, trying, deciding and backing yourself" },
  { name: "Relationships & Connection", focus: "Life with others", distinction: "Communication, support, intimacy and boundaries" },
  { name: "Career, Work & Business", focus: "Working life", distinction: "Contribution, ambitions, direction and practical progress" },
  { name: "Money & Stability", focus: "Financial footing", distinction: "Understanding commitments, resources and stability" },
  { name: "Purpose & Direction", focus: "Meaning", distinction: "Whether the direction reflects what matters to you" },
  { name: "Daily Structure & Discipline", focus: "Everyday follow-through", distinction: "Routines, time, focus and space for intended action" },
  { name: "Emotional Wellbeing", focus: "Inner experience", distinction: "Recognising feelings, handling stress and accessing support" },
  { name: "Self-Respect & Identity", focus: "Relationship with yourself", distinction: "Standards, promises, choices and who you are becoming" },
];

export const TEN_AREAS_OVERLAPS = [
  { pair: "Mindset and Confidence", text: "Mindset is about your thinking patterns; confidence is about trusting yourself to act." },
  { pair: "Career and Purpose", text: "Career is about your working life; purpose is about broader meaning and direction." },
  { pair: "Emotional Wellbeing and Self-Respect", text: "Emotional wellbeing is about your feelings; self-respect is about the standards and choices you practise." },
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
