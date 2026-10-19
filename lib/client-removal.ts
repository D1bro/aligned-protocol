// Who an admin can remove from a client's Settings tab. Kept free of
// server-only imports so the rules can be tested directly.

export type RemovalBlock = "self" | "staff" | "guest" | "billing";

export function removalBlock(
  person: { id: string; role: string; email: string | null },
  viewerId: string,
  hasBilling: boolean
): RemovalBlock | null {
  if (person.id === viewerId) return "self";
  if (person.role !== "client") return "staff";
  if (!person.email) return "guest";
  if (hasBilling) return "billing";
  return null;
}

export const REMOVAL_BLOCK_TEXT: Record<RemovalBlock, string> = {
  self: "This is your own account, so it can’t be removed here.",
  staff: "Coach and admin accounts can’t be removed. Change the account type to Client first if they’re leaving.",
  guest: "This is a guest: remove them from Clients → Guests.",
  billing: "They have invoices, payments or session credits on record (drafts included), so they’re kept for your accounts.",
};

// The typed confirmation: their email, ignoring case and stray spaces.
export function emailMatches(typed: string, email: string | null): boolean {
  if (!email) return false;
  return typed.trim().toLowerCase() === email.trim().toLowerCase();
}
