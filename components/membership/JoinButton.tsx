import { joinMembership } from "@/lib/actions/membership";
import { joinHref, offerFor } from "@/lib/offers";
import type { PaidTier } from "@/lib/membership";

// Join Momentum: Stripe Checkout when joining is open, otherwise an email to
// ask (lib/membership.ts). Practice isn't sold on its own.
export function JoinButton({ open, label, className = "btn btn-p" }: { tier?: PaidTier; open: boolean; label?: string; className?: string }) {
  const tier = "momentum" as const;
  const offer = offerFor(tier);
  if (!open) return <a href={joinHref(offer)} className={className}>Ask to join Momentum</a>;
  return (
    <form action={joinMembership.bind(null, tier)}>
      <button type="submit" className={className}>{label ?? `Join ${offer.name.replace("Aligned ", "")} · ${offer.price} ${offer.per}`}</button>
    </form>
  );
}
