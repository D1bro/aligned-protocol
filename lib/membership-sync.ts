import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeSubscription } from "@/lib/stripe";

// Keeps the memberships table in step with Stripe. Called with the service
// key from the Stripe webhook (renewals, changes, cancellations, failed
// payments) and when someone returns from Checkout, so access starts at once
// even before the webhook arrives. The member and their membership come from
// the subscription's own metadata, set when they joined.
export async function saveSubscription(admin: SupabaseClient, sub: StripeSubscription): Promise<{ ok: boolean; why?: string }> {
  const clientId = sub.metadata?.client_id;
  const tier = sub.metadata?.tier;
  if (!clientId || (tier !== "practice" && tier !== "momentum")) return { ok: false, why: "not an Aligned membership" };
  const item = sub.items?.data?.[0];
  const periodEnd = sub.current_period_end ?? item?.current_period_end ?? null;
  const row = {
    client_id: clientId,
    tier,
    status: sub.status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer as { id: string }).id,
    price_pence: item?.price?.unit_amount ?? 0,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
    ...(sub.start_date ? { started_at: new Date(sub.start_date * 1000).toISOString() } : {}),
  };
  if (!row.price_pence) return { ok: false, why: "no price" };
  const { error } = await admin.from("memberships").upsert(row, { onConflict: "stripe_subscription_id" });
  return error ? { ok: false, why: error.message } : { ok: true };
}
