// Guests: people who pressed "Begin my audit" without an account. Kept free
// of server-only imports so the rules can be tested directly.
//
// Removing a guest deletes their sign-in and everything they answered. A
// guest who left a coaching enquiry or has any billing record is never
// removed from here. The bulk clean-up only takes guests who never finished
// the audit; a finished guest can still be removed one at a time.

export const AUDIT_AREAS = 10;

export type GuestRow = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  answered: number;
  finished: boolean;
  score: number | null;
  enquiry: boolean;
  billing: boolean;
};

export type GuestState = "empty" | "started" | "finished";

export function guestState(g: Pick<GuestRow, "answered" | "finished">): GuestState {
  if (g.finished) return "finished";
  return g.answered > 0 ? "started" : "empty";
}

export const GUEST_STATE_LABEL: Record<GuestState, string> = {
  empty: "Not started",
  started: "Started, not finished",
  finished: "Finished",
};

// Never removed from the console: they've asked for coaching or have money on record.
export function isProtected(g: Pick<GuestRow, "enquiry" | "billing">): boolean {
  return g.enquiry || g.billing;
}

export function idleDaysOf(g: Pick<GuestRow, "lastActiveAt">, now: number): number {
  return Math.floor((now - new Date(g.lastActiveAt).getTime()) / 86_400_000);
}

export const IDLE_CHOICES = [7, 30, 90] as const;

// Who the bulk clean-up would remove: unfinished, not protected, and with
// nothing done for at least `idleDays` days.
export function idleGuests<T extends GuestRow>(guests: T[], idleDays: number, now: number): T[] {
  if (!Number.isFinite(idleDays) || idleDays < 1) return [];
  return guests.filter((g) => !g.finished && !isProtected(g) && idleDaysOf(g, now) >= idleDays);
}

// The latest of several timestamps (any may be missing).
export function latest(...dates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const d of dates) if (d && (!best || new Date(d) > new Date(best))) best = d;
  return best;
}
