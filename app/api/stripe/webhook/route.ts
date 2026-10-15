import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeEvent } from "@/lib/stripe-signature";
import { eventMatchesMode } from "@/lib/stripe-mode";
import { currentStripeMode } from "@/lib/stripe";

// Stripe tells us here when a card payment succeeds. Only signed events are
// trusted; each event is handled once; the payment is recorded against the
// invoice named in the payment's own metadata, and anything over what's owed
// stays on the client's account as unallocated money.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const raw = await req.text();
  const event = verifyStripeEvent(raw, req.headers.get("stripe-signature"), secret);
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  // Only events from the mode the site is in count (a test payment never
  // pays a real invoice, and the other way round).
  if (!eventMatchesMode((event as { livemode?: boolean }).livemode, currentStripeMode())) {
    return NextResponse.json({ error: "event mode doesn't match this site's Stripe mode" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: seen } = await db.from("provider_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  let outcome = "ignored";
  let invoiceId: string | null = null;
  const obj = event.data.object as {
    id?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    payment_intent?: string | null;
    metadata?: { invoice_id?: string; client_id?: string };
  };

  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && obj.payment_status === "paid") {
    invoiceId = obj.metadata?.invoice_id ?? null;
    const { data: inv } = invoiceId
      ? await db.from("invoices").select("id, client_id, status, number").eq("id", invoiceId).maybeSingle()
      : { data: null };
    if (!inv || inv.client_id !== obj.metadata?.client_id) {
      outcome = "no matching invoice";
    } else if ((obj.currency ?? "").toLowerCase() !== "gbp" || !obj.amount_total) {
      outcome = "not a GBP amount";
    } else {
      const externalId = obj.payment_intent || obj.id!;
      // The same payment can arrive under a new event id; it's only counted once.
      const { data: known } = await db.from("receipts").select("id").eq("source", "payment_link").eq("external_id", externalId).maybeSingle();
      if (known) {
        await db.from("provider_events").insert({ id: event.id, provider: "stripe", type: event.type, invoice_id: invoiceId, outcome: "already recorded" });
        return NextResponse.json({ received: true, outcome: "already recorded" });
      }
      const { data: receiptId, error } = await db.rpc("record_receipt", {
        p_client: inv.client_id,
        p_source: "payment_link",
        p_external_id: externalId,
        p_amount: obj.amount_total,
        p_currency: "GBP",
        p_received_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()),
        p_reference: `Card payment for ${inv.number}`,
        p_note: null,
        p_operation_key: `stripe:${externalId}`,
      });
      // Let Stripe retry if we couldn't record it.
      if (error) return NextResponse.json({ error: "could not record payment" }, { status: 500 });
      outcome = "recorded";
      if (inv.status === "issued") {
        const [{ data: bal }, { data: unapplied }] = await Promise.all([
          db.rpc("invoice_position", { p_invoice: inv.id }),
          db.rpc("receipt_unapplied", { p_receipt: receiptId }),
        ]);
        const balance = ((Array.isArray(bal) ? bal[0] : bal) as { balance: number } | null)?.balance ?? 0;
        const put = Math.min(balance, (unapplied as number | null) ?? 0);
        if (put > 0) {
          const { error: aErr } = await db.rpc("allocate_receipt", { p_receipt: receiptId, p_invoice: inv.id, p_amount: put });
          outcome = aErr ? "recorded, not allocated" : put < obj.amount_total ? "recorded, part unallocated" : "recorded and allocated";
        } else outcome = "recorded, nothing owed (unallocated)";
      } else outcome = "recorded, invoice not open (unallocated)";
    }
  }

  await db.from("provider_events").insert({ id: event.id, provider: "stripe", type: event.type, invoice_id: invoiceId, outcome });
  return NextResponse.json({ received: true, outcome });
}
