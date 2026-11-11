// Duane's films and audio, by slot (Duane, 11 Nov 2026): he pastes a link
// for each in Console → Films. Until a slot has a link (or a file in the
// site's own media folder), the page shows nothing in its place: no "coming
// soon". Pure, so it can be tested.

export type FilmSlot = { id: string; title: string; where: string; kind: "film" | "audio"; group: string };

// The ids match the clips' ids in lib/audit-guides.ts and NEXT_STEP_FILMS.
export const FILM_SLOTS: FilmSlot[] = [
  { id: "next-step-here", title: "Where you are", where: "The Next Step · screen 1", kind: "film", group: "The Next Step" },
  { id: "next-step-ten", title: "Your destination", where: "The Next Step · screen 2", kind: "film", group: "The Next Step" },
  { id: "next-step-step", title: "Your Next Step", where: "The Next Step · screen 3", kind: "film", group: "The Next Step" },
  { id: "next-step-way", title: "What’s in the way", where: "The Next Step · screen 4", kind: "film", group: "The Next Step" },
  { id: "next-step-moves", title: "Your route", where: "The Next Step · screen 5", kind: "film", group: "The Next Step" },
  { id: "next-step-set", title: "What happens next", where: "Your Next Step is set", kind: "film", group: "The Next Step" },
  { id: "F01", title: "A welcome from Duane", where: "Home page", kind: "film", group: "Site" },
  { id: "O01", title: "Momentum and Focus", where: "Support options", kind: "film", group: "Site" },
  { id: "C01", title: "Coaching with an Aligned Coach", where: "Coaching", kind: "film", group: "Site" },
  { id: "D01", title: "Your daily intention", where: "Daily practice · morning", kind: "audio", group: "Daily practice" },
  { id: "D02", title: "Evening reflection", where: "Daily practice · evening", kind: "audio", group: "Daily practice" },
];

export const isSlot = (id: string) => FILM_SLOTS.some((s) => s.id === id);

// A link as pasted: YouTube, Vimeo and Loom play in their own player; any
// other https link is played as a file (an .mp4 or .mp3).
export type FilmSource = { kind: "embed"; src: string } | { kind: "file"; src: string };
export function filmSource(url: string | null | undefined): FilmSource | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1];
    return id ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,}$/.test(id) ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:\/video)?\/(\d+)(?:\/([0-9a-f]+))?/);
    if (!m) return null;
    const hash = m[2] ?? u.searchParams.get("h");
    return { kind: "embed", src: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}` };
  }
  if (host === "loom.com") {
    const id = u.pathname.match(/^\/(?:share|embed)\/([0-9a-f]{16,})/)?.[1];
    return id ? { kind: "embed", src: `https://www.loom.com/embed/${id}` } : null;
  }
  return { kind: "file", src: u.toString() };
}

// What's wrong with a pasted link, in plain words, or null if it's fine.
export function linkProblem(url: string, kind: FilmSlot["kind"]): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (raw.length > 500) return "That link is too long.";
  const s = filmSource(raw);
  if (!s) return "Paste the full link, starting https://. YouTube, Vimeo and Loom links work, or a link to an .mp4 file.";
  if (kind === "audio" && s.kind === "embed") return "For audio, paste a link to the .mp3 file itself.";
  return null;
}
