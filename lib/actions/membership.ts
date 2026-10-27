"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/admin";
import {
  changeSubscriptionTier,
  createMembershipCheckout,
  createPortalSession,
  getCheckoutSubscription,
  getSubscription,
  setCancelAtPeriodEnd,
  stripeStatus,
} from "@/lib/stripe";
import { saveSubscription } from "@/lib/membership-sync";
import { bestAccess, membershipsOpen, type MembershipAccess, type PaidTier } from "@/lib/membership";
import { offerFor } from "@/lib/offers";

// Memberships: joining, changing, cancelling, and what each member has.
// Stripe is the record of payment; the memberships table (migration 0022)
// mirrors it, written only through lib/membership-sync.ts.

export type MembershipRow = {
  id: string;
  tier: PaidTier;
  status: string;
  price_pence: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  started_at: string;
  ended_at: string | null;
};

const LIVE_STATES = ["trialing", "active", "past_due", "incomplete", "unpaid"];

export async function joiningOpen() {
  return membershipsOpen({ open: process.env.MEMBERSHIPS_OPEN, production: process.env.VERCEL_ENV === "production" }) && stripeStatus().ready;
}

// What the signed-in member has right now. Clarity (free) for guests, and
// before migration 0022 has run.
export async function getMyAccess(): Promise<MembershipAccess> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_membership");
  if (error || !data) return { tier: "clarity", source: null, until: null };
  return bestAccess(data as { tier: string; source: string; until: string | null }[]);
}

// Their subscriptions, newest first: the one to manage is the first still running.
async function mySubscriptions(): Promise<MembershipRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, tier, status, price_pence, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, started_at, ended_at")
    .order("started_at", { ascending: false });
  return error ? [] : ((data ?? []) as MembershipRow[]);
}

export async function getMyMembership() {
  const [access, subs, open] = await Promise.all([getMyAccess(), mySubscriptions(), joiningOpen()]);
  const current = subs.find((s) => LIVE_STATES.includes(s.status)) ?? null;
  return { access, current, past: subs.filter((s) => s !== current), open };
}

async function signedInMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const back = (message: string): never => redirect(`/membership?error=${encodeURIComponent(message)}`);

// Join Practice or Momentum: Stripe Checkout, or a switch if they already
// have the other one.
export async function joinMembership(tier: PaidTier) {
  const user = await signedInMember();
  if (!user) redirect("/login?signup=1");
  if (!(await joiningOpen())) back("Joining on the site isn’t open yet. Use “Join the founding list” on the offers page.");
  const { current } = await getMyMembership();
  if (current?.tier === tier) redirect("/membership");
  if (current) return changeMembership(tier);
  const offer = offerFor(tier);
  const subs = await mySubscriptions();
  const res = await createMembershipCheckout({
    clientId: user.id,
    tier,
    name: offer.name,
    pricePence: offer.pricePence!,
    customerId: subs[0]?.stripe_customer_id ?? null,
    email: user.email ?? null,
    origin: await origin(),
  });
  if (!res.ok) back(res.message);
  redirect(res.ok ? res.data : "/membership");
}

// Back from Checkout: record the subscription straight away (the webhook
// confirms it too). Only ever for the member who started the checkout.
// Called while /membership renders, which then reads the fresh row.
export async function confirmCheckout(sessionId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await signedInMember();
  if (!user || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { ok: false };
  const res = await getCheckoutSubscription(sessionId);
  if (!res.ok) return { ok: false, message: res.message };
  if (res.data.client_reference_id !== user.id || !res.data.subscription) return { ok: false };
  const saved = await saveSubscription(createAdminClient(), res.data.subscription);
  return saved.ok ? { ok: true } : { ok: false, message: "Your payment went through, but your membership is still being set up. Refresh in a minute." };
}

async function refresh(subscriptionId: string) {
  const fresh = await getSubscription(subscriptionId);
  if (fresh.ok) await saveSubscription(createAdminClient(), fresh.data);
  revalidatePath("/", "layout");
}

export async function changeMembership(tier: PaidTier) {
  const user = await signedInMember();
  if (!user) redirect("/login");
  const { current } = await getMyMembership();
  if (!current) redirect("/offers");
  if (current.tier === tier) redirect("/membership");
  const sub = await getSubscription(current.stripe_subscription_id);
  if (!sub.ok) back(sub.message);
  const offer = offerFor(tier);
  const res = sub.ok ? await changeSubscriptionTier(sub.data, tier, offer.name, offer.pricePence!) : null;
  if (!res?.ok) back(res?.message ?? "Couldn’t change your membership — try again.");
  await refresh(current.stripe_subscription_id);
  redirect("/membership?changed=1");
}

// Cancel at the end of the paid month (they keep everything until then, and
// their work stays afterwards), or keep it after all.
export async function setMembershipCancelled(cancel: boolean) {
  const user = await signedInMember();
  if (!user) redirect("/login");
  const { current } = await getMyMembership();
  if (!current) redirect("/membership");
  const res = await setCancelAtPeriodEnd(current.stripe_subscription_id, cancel);
  if (!res.ok) back(res.message);
  await refresh(current.stripe_subscription_id);
  redirect(`/membership?${cancel ? "cancelled" : "kept"}=1`);
}

// Stripe's own page for their card and invoices.
export async function openBillingPage() {
  const user = await signedInMember();
  if (!user) redirect("/login");
  const subs = await mySubscriptions();
  if (!subs[0]) redirect("/membership");
  const res = await createPortalSession(subs[0].stripe_customer_id, `${await origin()}/membership`);
  if (!res.ok) back(/portal|configuration/i.test(res.message) ? "Card and invoice settings aren’t switched on yet. Please contact us and we’ll sort it." : res.message);
  redirect(res.ok ? res.data.url : "/membership");
}

// Momentum: the weekly session's time, join link and note.
export type MomentumDetails = { momentum_when: string | null; momentum_join_url: string | null; momentum_note: string | null };

export async function getMomentumDetails(): Promise<MomentumDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("membership_settings").select("momentum_when, momentum_join_url, momentum_note").maybeSingle();
  return error ? null : ((data as MomentumDetails | null) ?? null);
}

export async function saveMomentumDetails(input: { when: string; joinUrl: string; note: string }): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const url = input.joinUrl.trim();
  if (url && !/^https:\/\/\S+$/.test(url)) return { ok: false, message: "The join link must start with https://" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_settings")
    .update({ momentum_when: input.when.trim().slice(0, 200) || null, momentum_join_url: url || null, momentum_note: input.note.trim().slice(0, 1000) || null })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Couldn’t save — has database update 0022 been run?" };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Admin: everyone's memberships, for the console.
export async function getAllMemberships(): Promise<(MembershipRow & { client_id: string })[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, client_id, tier, status, price_pence, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, started_at, ended_at")
    .order("started_at", { ascending: false });
  return error ? [] : ((data ?? []) as (MembershipRow & { client_id: string })[]);
}
