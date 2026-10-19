// Links in the sign-in emails point at the-aligned.com/auth/confirm (not at
// Supabase), so they match the sending domain and work on any device. Kept
// free of server-only imports so the rules can be tested directly.

export const LINK_TYPES = ["email", "signup", "invite", "magiclink", "recovery", "email_change"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export function linkType(value: string | null): LinkType | null {
  return (LINK_TYPES as readonly string[]).includes(value ?? "") ? (value as LinkType) : null;
}

// Where to go after confirming: a path on this site only, never another site.
export function safeNext(value: string | null, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "https://x.invalid");
    return url.origin === "https://x.invalid" ? url.pathname + url.search : fallback;
  } catch {
    return fallback;
  }
}
