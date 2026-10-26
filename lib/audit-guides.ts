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

// In production the MP4s only exist at the hosted URL; if it isn't set, show
// posters with "video coming soon" rather than broken players.
const VIDEO_BASE =
  process.env.NEXT_PUBLIC_AUDIT_VIDEO_BASE_URL?.replace(/\/$/, "") ||
  (process.env.NODE_ENV === "production" ? null : "/media/audit/clips");
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

// `version` overrides MEDIA_VERSION for a film re-cut on its own; `captions:
// false` is for films with captions already in the picture (no separate track).
function clip(
  id: string, name: string, title: string, label: string, durationSeconds: number,
  { withVideo = true, version = MEDIA_VERSION, captions = true }: { withVideo?: boolean; version?: string; captions?: boolean } = {},
): GuideClip {
  const slug = `${name}-${version}`;
  return {
    id,
    title,
    label,
    src: withVideo && VIDEO_BASE ? `${VIDEO_BASE}/${slug}.mp4` : null,
    // Designed title cards (Oct 2026): the same intro image style for every audit film.
    poster: `${MEDIA}/posters/${slug}-card.jpg`,
    captions: captions ?`${MEDIA}/captions/${slug}.vtt` : null,
    durationSeconds,
  };
}

export const INTRO_GUIDE: GuideClip = clip("introduction", "00-introduction", "Introduction and scoring guide", "How the audit works", 36.3);

// v8 (Oct 2026): the full after-audit talk, 2 min 51, branded, captions in the picture.
export const CLOSING_GUIDE: GuideClip = clip("closing", "11-snapshot-and-next-step", "Your snapshot and next step", "Your snapshot and next step", 171, { version: "v8", captions: false });

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

// Films for the rest of the site, by internal production code (never shown
// to visitors). The audit films above are A00 (INTRO_GUIDE), A01–A10
// (AREA_GUIDES) and F02 (CLOSING_GUIDE). For the slots below, `file` is null
// until the film exists; pages then show their text fallback instead of a
// player. To add one: upload <file>-<version>.mp4 to the video folder, put
// <file>-<version>.jpg in public/media/audit/posters/ and <file>-<version>.vtt
// in public/media/audit/captions/, then set `file` (and `version`) here.
// docs/FILMS.md has the step-by-step.
type FilmSpec = { file: string | null; version?: string; title: string; label: string; durationSeconds?: number };

function film(s: FilmSpec): GuideClip | null {
  if (!s.file) return null;
  const slug = `${s.file}-${s.version ?? "v1"}`;
  return {
    id: s.file,
    title: s.title,
    label: s.label,
    src: VIDEO_BASE ? `${VIDEO_BASE}/${slug}.mp4` : null,
    poster: `${MEDIA}/posters/${slug}.jpg`,
    captions: `${MEDIA}/captions/${slug}.vtt`,
    durationSeconds: s.durationSeconds ?? 0,
  };
}

export const FILMS = {
  F01: film({ file: null, title: "Welcome from Duane", label: "A welcome from Duane" }),
  F02: CLOSING_GUIDE,
  F03: film({ file: null, title: "A worked example", label: "Worked example · from snapshot to action" }),
  F04: film({ file: null, title: "Your profile", label: "Getting started with your profile" }),
  F05: film({ file: null, title: "Your goal check-in", label: "How the goal check-in works" }),
  L01: film({ file: null, title: "Seeing where you are", label: "Academy · lesson 1" }),
  L02: film({ file: null, title: "Choosing one place to start", label: "Academy · lesson 2" }),
  L03: film({ file: null, title: "What matters here", label: "Academy · lesson 3" }),
  L04: film({ file: null, title: "From clarity to one step", label: "Academy · lesson 4" }),
  M01: film({ file: null, title: "Musing 1", label: "Duane’s Musings" }),
  M02: film({ file: null, title: "Musing 2", label: "Duane’s Musings" }),
} satisfies Record<string, GuideClip | null>;

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
