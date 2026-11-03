// The connected journal (brief, 3 Nov 2026): one journal, organised by date,
// with optional prompts, a linked goal, images and one video link. Pure
// helpers, so they can be tested; reads and writes are in
// lib/actions/journal.ts.

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Prompts to start from, if a blank page doesn't help. Today's is chosen by
// the date so it's the same all day.
export const PROMPTS = [
  "What’s on my mind right now?",
  "What am I grateful for today?",
  "What did I notice about myself this week?",
  "What do I want more of, and less of?",
  "What’s one thing I handled well?",
  "What’s getting in the way, and what would help?",
  "What would I tell a friend in my position?",
  "What matters most to me this week?",
];

export function todaysPrompt(today: string): string {
  return PROMPTS[Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000) % PROMPTS.length];
}

const clip = (s: string, n = 60) => {
  const t = s.trim().replace(/[.!]+$/, "");
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
};

// Prompts from their own plan: this week's focus and this month's intention.
export function planPrompts(input: { focus: string | null; intention: string | null }): string[] {
  const out: string[] = [];
  if (input.focus?.trim()) out.push(`How did “${clip(input.focus)}” go this week?`);
  if (input.intention?.trim()) out.push(`Is this month living up to “${clip(input.intention)}”?`);
  return out;
}

// A video link: https only, shown as a card naming the site. Nothing from the
// site is loaded in the journal.
export function checkVideoUrl(value: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const v = value.trim();
  if (!v) return { ok: true, value: null };
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return { ok: false, message: "That doesn’t look like a link. Paste the whole address, starting https://" };
  }
  if (url.protocol !== "https:") return { ok: false, message: "Use a link that starts https://" };
  if (v.length > 500) return { ok: false, message: "That link is too long." };
  return { ok: true, value: url.toString() };
}

export function videoSite(url: string): string {
  const host = new URL(url).hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
  if (host.endsWith("vimeo.com")) return "Vimeo";
  if (host.endsWith("loom.com")) return "Loom";
  if (host.endsWith("tiktok.com")) return "TikTok";
  if (host.endsWith("instagram.com")) return "Instagram";
  return host;
}

// An image path belongs to its writer: "{their id}/{file}".
export function ownImages(paths: unknown, userId: string): string[] | null {
  if (!Array.isArray(paths) || paths.length > MAX_IMAGES) return null;
  return paths.every((p) => typeof p === "string" && p.startsWith(`${userId}/`) && !p.includes("..") && p.length <= 200) ? (paths as string[]) : null;
}

// Entries grouped under their month, newest first (entries arrive newest first).
export function byMonth<T extends { entry_date: string }>(entries: T[]): { month: string; entries: T[] }[] {
  const groups: { month: string; entries: T[] }[] = [];
  for (const e of entries) {
    const month = e.entry_date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.entries.push(e);
    else groups.push({ month, entries: [e] });
  }
  return groups;
}
