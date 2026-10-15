import "server-only";

// Card payments through Stripe Checkout, test mode only for now. Without a
// test key the app says "card payments aren't set up" and bank transfer
// still works. Live keys are refused until launch is agreed.

export function stripeStatus(): { ready: boolean; reason?: string } {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return { ready: false, reason: "Card payments aren’t set up yet (no Stripe key)." };
  if (!/^(sk|rk)_test_/.test(key)) return { ready: false, reason: "Only Stripe test keys are allowed until launch." };
  return { ready: true };
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
