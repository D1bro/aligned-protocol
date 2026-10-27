import "server-only";
import { stripeMode, type StripeMode } from "@/lib/stripe-mode";

// Card payments through Stripe Checkout. Without a key the app says "card
// payments aren't set up" and bank transfer still works. Test keys work on
// your Mac and previews, never on the live site; live keys only work once
// STRIPE_ALLOW_LIVE=true is set (see lib/stripe-mode.ts).

export function currentStripeMode(): StripeMode {
  return stripeMode(process.env.STRIPE_SECRET_KEY ?? "", {
    allowLive: process.env.STRIPE_ALLOW_LIVE === "true",
    production: process.env.VERCEL_ENV === "production",
  });
}

export function stripeStatus(): { ready: boolean; reason?: string } {
  const m = currentStripeMode();
  return m.ready ? { ready: true } : { ready: false, reason: m.reason };
}

// A one-off Checkout page for what's still owed on an invoice.
export async function createCheckout(input: {
  invoiceId: string;
  clientId: string;
  number: string;
  amountPence: number;
  customerEmail: string | null;
  returnUrl: string;
}): Promise<{ ok: true; url: string; id: string } | { ok: false; message: string }> {
  const status = stripeStatus();
  if (!status.ready) return { ok: false, message: status.reason! };
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(input.amountPence),
    "line_items[0][price_data][product_data][name]": `Invoice ${input.number}`,
    client_reference_id: input.invoiceId,
    "metadata[invoice_id]": input.invoiceId,
    "metadata[client_id]": input.clientId,
    "payment_intent_data[metadata][invoice_id]": input.invoiceId,
    "payment_intent_data[description]": `Invoice ${input.number}`,
    success_url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}paid=1`,
    cancel_url: input.returnUrl,
  });
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Two clicks for the same amount reuse the same Checkout page.
        "Idempotency-Key": `checkout:${input.invoiceId}:${input.amountPence}:${Math.floor(Date.now() / 600_000)}`,
      },
      body,
    });
    const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !json.url || !json.id) return { ok: false, message: json.error?.message ?? "Stripe didn’t create a payment page." };
    return { ok: true, url: json.url, id: json.id };
  } catch {
    return { ok: false, message: "Couldn’t reach Stripe — try again." };
  }
}

// Memberships ---------------------------------------------------------------
// Monthly subscriptions for Aligned Practice and Aligned Momentum. The price
// comes from lib/offers.ts at the moment someone joins and stays with their
// subscription, so founding members keep their founding price.

type StripeResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function stripeApi<T>(path: string, init: { method?: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<StripeResult<T>> {
  const status = stripeStatus();
  if (!status.ready) return { ok: false, message: status.reason! };
  try {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body,
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) return { ok: false, message: json.error?.message ?? "Stripe couldn’t do that just now." };
    return { ok: true, data: json };
  } catch {
    return { ok: false, message: "Couldn’t reach Stripe — try again." };
  }
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  ended_at?: number | null;
  start_date?: number;
  metadata?: { client_id?: string; tier?: string };
  items: { data: { id: string; current_period_end?: number; price: { unit_amount: number | null; product: string } }[] };
};

// One Stripe product per membership, found by its metadata (made the first
// time it's needed).
const products = new Map<string, string>();
async function membershipProduct(tier: "practice" | "momentum", name: string): Promise<StripeResult<string>> {
  const cached = products.get(tier);
  if (cached) return { ok: true, data: cached };
  const query = encodeURIComponent(`metadata['aligned_offer']:'${tier}' AND active:'true'`);
  const found = await stripeApi<{ data: { id: string }[] }>(`products/search?query=${query}`);
  if (found.ok && found.data.data[0]) {
    products.set(tier, found.data.data[0].id);
    return { ok: true, data: found.data.data[0].id };
  }
  const made = await stripeApi<{ id: string }>("products", {
    body: new URLSearchParams({ name, "metadata[aligned_offer]": tier }),
    idempotencyKey: `aligned-product-${tier}`,
  });
  if (!made.ok) return made;
  products.set(tier, made.data.id);
  return { ok: true, data: made.data.id };
}

function monthlyPrice(prefix: string, product: string, pricePence: number) {
  return {
    [`${prefix}[currency]`]: "gbp",
    [`${prefix}[unit_amount]`]: String(pricePence),
    [`${prefix}[product]`]: product,
    [`${prefix}[recurring][interval]`]: "month",
  };
}

// Stripe's Checkout page for joining. Their card is saved for the monthly payments.
export async function createMembershipCheckout(input: {
  clientId: string;
  tier: "practice" | "momentum";
  name: string;
  pricePence: number;
  customerId: string | null;
  email: string | null;
  origin: string;
}): Promise<StripeResult<string>> {
  const product = await membershipProduct(input.tier, input.name);
  if (!product.ok) return product;
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][quantity]": "1",
    ...monthlyPrice("line_items[0][price_data]", product.data, input.pricePence),
    client_reference_id: input.clientId,
    "metadata[client_id]": input.clientId,
    "metadata[tier]": input.tier,
    "subscription_data[metadata][client_id]": input.clientId,
    "subscription_data[metadata][tier]": input.tier,
    success_url: `${input.origin}/membership?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/offers`,
  });
  if (input.customerId) body.set("customer", input.customerId);
  else if (input.email) body.set("customer_email", input.email);
  const res = await stripeApi<{ url?: string }>("checkout/sessions", {
    body,
    idempotencyKey: `join:${input.clientId}:${input.tier}:${Math.floor(Date.now() / 600_000)}`,
  });
  if (!res.ok) return res;
  return res.data.url ? { ok: true, data: res.data.url } : { ok: false, message: "Stripe didn’t create a payment page." };
}

export async function getCheckoutSubscription(sessionId: string) {
  return stripeApi<{ client_reference_id: string | null; subscription: StripeSubscription | null }>(
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`
  );
}

export async function getSubscription(id: string) {
  return stripeApi<StripeSubscription>(`subscriptions/${encodeURIComponent(id)}`);
}

// Practice ⇄ Momentum: the same subscription at the other price, with Stripe
// working out the difference for the rest of the month.
export async function changeSubscriptionTier(sub: StripeSubscription, tier: "practice" | "momentum", name: string, pricePence: number) {
  const product = await membershipProduct(tier, name);
  if (!product.ok) return product;
  return stripeApi<StripeSubscription>(`subscriptions/${encodeURIComponent(sub.id)}`, {
    body: new URLSearchParams({
      "items[0][id]": sub.items.data[0].id,
      ...monthlyPrice("items[0][price_data]", product.data, pricePence),
      proration_behavior: "create_prorations",
      "metadata[tier]": tier,
    }),
  });
}

// Cancel at the end of the paid month, or change their mind before then.
export async function setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
  return stripeApi<StripeSubscription>(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
    body: new URLSearchParams({ cancel_at_period_end: String(cancel) }),
  });
}

// Stripe's page for updating their card and seeing invoices.
export async function createPortalSession(customerId: string, returnUrl: string) {
  return stripeApi<{ url: string }>("billing_portal/sessions", {
    body: new URLSearchParams({ customer: customerId, return_url: returnUrl }),
  });
}
