// Duane's video guidance for the audit, in one place.
//
// To add a finished clip, set its `src` to the video URL (a file in
// public/media/audit/, or a hosted URL such as Vercel Blob). Leave `src` as
// null and the page shows the poster with a "video coming soon" label instead.
// `poster` is the still shown before playback.
//
// Areas are keyed by life_areas.sort_order (1–10), the same order as the
// audit and the training video.

export type GuideClip = {
  src: string | null;
  poster: string | null;
  label: string;
};

export type AreaGuide = GuideClip & {
  // The reflective question Duane asks for this area in the video.
  prompt: string;
};

const PLACEHOLDER_POSTER = "/media/audit/guide-poster.jpg";

export const INTRO_GUIDE: GuideClip = {
  src: null,
  poster: PLACEHOLDER_POSTER,
  label: "How the audit works",
};

export const AREA_GUIDES: Record<number, AreaGuide> = {
  1: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "How well are you looking after your body, and how are you actually feeling?" },
  2: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Does your thinking help you move forward, or hold you back?" },
  3: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "How much do you trust yourself to go after what you want?" },
  4: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Do you feel supported, and can you be yourself?" },
  5: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Are you moving towards something you actually want to be doing?" },
  6: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "How clear and stable does your financial situation feel right now?" },
  7: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Does the direction you’re taking reflect what matters to you?" },
  8: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Do your routines make room for what matters?" },
  9: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "How do you handle what you feel?" },
  10: { src: null, poster: PLACEHOLDER_POSTER, label: "Duane’s guide", prompt: "Are your everyday choices aligned with the person you say you are?" },
};
