// Duane's video guidance for the audit — the single media manifest.
//
// Mirrors media-manifest.json from the v7 clips package (12 clips: an
// introduction, one per area, and a closing "snapshot and next step").
//
// Posters and caption tracks are small and live in public/media/audit/.
// The MP4s (~110 MB) are hosted outside the repo: set
// NEXT_PUBLIC_AUDIT_VIDEO_BASE_URL to the folder that holds them (e.g. a public
// Supabase Storage bucket). Locally it falls back to public/media/audit/clips/,
// which is git-ignored. Files are named <clip>-<MEDIA_VERSION>.mp4; for a new export
// upload the new versioned files and bump MEDIA_VERSION. Pass withVideo = false to show the
// poster with a "video coming soon" label instead.

const VIDEO_BASE = (process.env.NEXT_PUBLIC_AUDIT_VIDEO_BASE_URL || "/media/audit/clips").replace(/\/$/, "");
const MEDIA = "/media/audit";

export type GuideClip = {
  id: string;
  title: string;
  label: string;
  src: string | null;
  poster: string | null;
  // English speech captions, switchable from the player's CC control (off by default).
  captions: string | null;
  durationSeconds: number;
};

export type AreaGuide = GuideClip & {
  // The reflective question Duane asks for this area in the video.
  prompt: string;
};

// Bump when a new export replaces the clips, so browsers never serve a cached
// older video, poster or caption file under the same URL.
const MEDIA_VERSION = "v7";

function clip(id: string, name: string, title: string, label: string, durationSeconds: number, withVideo = true): GuideClip {
  const slug = `${name}-${MEDIA_VERSION}`;
  return {
    id,
    title,
    label,
    src: withVideo ? `${VIDEO_BASE}/${slug}.mp4` : null,
    poster: `${MEDIA}/posters/${slug}.jpg`,
    captions: `${MEDIA}/captions/${slug}.vtt`,
    durationSeconds,
  };
}

export const INTRO_GUIDE: GuideClip = clip("introduction", "00-introduction", "Introduction and scoring guide", "How the audit works", 36.3);

export const CLOSING_GUIDE: GuideClip = clip("closing", "11-snapshot-and-next-step", "Your snapshot and next step", "Your snapshot and next step", 14.13);

// Keyed by life_areas.sort_order (1–10), the same order as the audit and the video.
export const AREA_GUIDES: Record<number, AreaGuide> = {
  1: { ...clip("area-01", "01-health-energy", "Health & Energy", "Health & Energy · Duane’s guide", 13.8), prompt: "How well are you looking after your body, and how are you actually feeling?" },
  2: { ...clip("area-02", "02-mindset-thinking", "Mindset & Thinking", "Mindset & Thinking · Duane’s guide", 12.7), prompt: "Does your thinking help you move forward, or hold you back?" },
  3: { ...clip("area-03", "03-confidence-self-belief", "Confidence & Self-Belief", "Confidence & Self-Belief · Duane’s guide", 13.9), prompt: "How much do you trust yourself to go after what you want?" },
  4: { ...clip("area-04", "04-relationships-connection", "Relationships & Connection", "Relationships & Connection · Duane’s guide", 15.3), prompt: "Do you feel supported, and can you be yourself?" },
  5: { ...clip("area-05", "05-career-work-business", "Career, Work & Business", "Career, Work & Business · Duane’s guide", 14.4), prompt: "Are you moving towards something you actually want to be doing?" },
  6: { ...clip("area-06", "06-money-stability", "Money & Stability", "Money & Stability · Duane’s guide", 13.8), prompt: "How clear and stable does your financial situation feel right now?" },
  7: { ...clip("area-07", "07-purpose-direction", "Purpose & Direction", "Purpose & Direction · Duane’s guide", 13.3), prompt: "Does the direction you’re taking reflect what matters to you?" },
  8: { ...clip("area-08", "08-daily-structure-discipline", "Daily Structure & Discipline", "Daily Structure & Discipline · Duane’s guide", 12.3), prompt: "Do your routines make room for what matters?" },
  9: { ...clip("area-09", "09-emotional-wellbeing", "Emotional Wellbeing", "Emotional Wellbeing · Duane’s guide", 17.9), prompt: "How do you handle what you feel?" },
  10: { ...clip("area-10", "10-self-respect-identity", "Self-Respect & Identity", "Self-Respect & Identity · Duane’s guide", 10.6), prompt: "Are your everyday choices aligned with the person you say you are?" },
};

// Short labels for the life map, where full area names don't fit.
export const AREA_SHORT_NAMES: Record<number, string> = {
  1: "Health",
  2: "Mindset",
  3: "Confidence",
  4: "Relationships",
  5: "Career",
  6: "Money",
  7: "Purpose",
  8: "Structure",
  9: "Emotions",
  10: "Self-respect",
};
