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
