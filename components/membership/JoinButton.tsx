import { joinMembership } from "@/lib/actions/membership";
import { joinHref, offerFor } from "@/lib/offers";
import type { PaidTier } from "@/lib/membership";

// Join Practice or Momentum: Stripe Checkout when joining is open, otherwise
// the founding-list email (lib/membership.ts).
export function JoinButton({ tier, open, label, className = "btn btn-p" }: { tier: PaidTier; open: boolean; label?: string; className?: string }) {
  const offer = offerFor(tier);
  if (!open) return <a href={joinHref(offer)} className={className}>Join the founding list</a>;
  return (
    <form action={joinMembership.bind(null, tier)}>
      <button type="submit" className={className}>{label ?? `Join ${offer.name.replace("Aligned ", "")} · ${offer.price} ${offer.per}`}</button>
    </form>
  );
}
