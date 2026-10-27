// Who has which membership, and what it opens. Kept free of server-only
// imports so the rules can be tested directly.
//
//   Clarity (free)  plan, reviews, dashboard
//   Practice        + Daily Alignment (the daily intention practice) and the journal
//   Momentum        + the live weekly session
//
// Coaches and admins have everything, to practise and support members.

export type Tier = "clarity" | "practice" | "momentum";
export type PaidTier = Exclude<Tier, "clarity">;
const RANK: Record<Tier, number> = { clarity: 0, practice: 1, momentum: 2 };

export type MembershipAccess = { tier: Tier; source: "subscription" | "package" | null; until: string | null };

// The best of what they hold now (a subscription, or a package such as
// Aligned Focus that includes one).
export function bestAccess(rows: { tier: string; source: string; until: string | null }[]): MembershipAccess {
  let best: MembershipAccess = { tier: "clarity", source: null, until: null };
  for (const r of rows) {
    const tier = r.tier === "momentum" || r.tier === "practice" ? r.tier : null;
    if (!tier) continue;
    const later = !best.until || (r.until !== null && r.until > best.until);
    if (RANK[tier] > RANK[best.tier] || (RANK[tier] === RANK[best.tier] && later)) {
      best = { tier, source: r.source === "package" ? "package" : "subscription", until: r.until };
    }
  }
  return best;
}

const staffRole = (role: string | null | undefined) => role === "coach" || role === "admin";

export function hasPractice(tier: Tier, role?: string | null) {
  return staffRole(role) || RANK[tier] >= RANK.practice;
}
export function hasMomentum(tier: Tier, role?: string | null) {
  return staffRole(role) || tier === "momentum";
}

// Joining on the site: always on previews and locally (Stripe test mode);
// on the live site only once MEMBERSHIPS_OPEN=true is set (after the terms
// and privacy pages are approved). Until then the buttons ask to join the
// founding list by email.
export function membershipsOpen(env: { open?: string; production: boolean }) {
  return env.open === "true" || !env.production;
}

// A Stripe subscription status, in words.
export function statusWords(status: string, cancelAtPeriodEnd: boolean): string {
  if (status === "past_due" || status === "unpaid") return "Payment didn’t go through";
  if (status === "canceled" || status === "incomplete_expired") return "Ended";
  if (status === "incomplete") return "Waiting for payment";
  if (cancelAtPeriodEnd) return "Ends at the end of this month";
  return "Active";
}
