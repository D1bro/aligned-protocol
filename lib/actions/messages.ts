"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { emailStatus, sendEmail } from "@/lib/email";
import { buildMessage, clientFacingSummary, type MessageInput } from "@/lib/messages";
import { requestOrigin } from "@/lib/request-origin";
import { formatSessionTime } from "@/lib/time";
import { formatPence } from "@/lib/money";
import { stripeStatus } from "@/lib/stripe";

// Emails to a client, always started by a person. The email is built on the
// server from what's in the app (never from text sent by the browser, apart
// from an optional personal note), previewed, then sent once: a repeat click
// finds the same record instead of sending again.

export type MessageKind = "summary_shared" | "session_update" | "invoice_issued" | "payment_received";
export type MessageJob = {
  id: string;
  kind: MessageKind;
  dedupe_key: string;
  to_email: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  error: string | null;
  session_id: string | null;
  summary_id: string | null;
  invoice_id: string | null;
  receipt_id: string | null;
  created_at: string;
  sent_at: string | null;
};

type Built = {
  clientId: string;
  to: string;
  replyTo: string | null;
  dedupeKey: string;
  refs: { session_id?: string; summary_id?: string; invoice_id?: string; receipt_id?: string };
  input: MessageInput;
};
type Fail = { ok: false; message: string };

const ukDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "there";

// Work out the email for one thing (a shared summary, a session change, an
// invoice, a payment) from the database, checking it's in a state worth emailing.
async function build(kind: MessageKind, refId: string, note: string | null, opts: { includeSummary?: boolean } = {}): Promise<Built | Fail> {
  const me = await requireStaff();
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data: meProfile } = await supabase.from("profiles").select("email, full_name").eq("id", me.id).maybeSingle();
  const client = async (id: string) =>
    (await supabase.from("profiles").select("id, full_name, email").eq("id", id).maybeSingle()).data as { id: string; full_name: string | null; email: string | null } | null;

  if (kind === "summary_shared") {
    const { data: s } = await supabase.from("session_summaries").select("id, session_id, client_id, status, content").eq("id", refId).maybeSingle();
    if (!s || s.status !== "published") return { ok: false, message: "Share the summary first; then you can email about it." };
    const [{ data: sess }, c, { data: upcoming }] = await Promise.all([
      supabase.from("coaching_sessions").select("scheduled_at, timezone").eq("id", s.session_id).maybeSingle(),
      client(s.client_id),
      supabase
        .from("coaching_sessions")
        .select("scheduled_at, timezone, duration_minutes, state, location")
        .eq("client_id", s.client_id)
        .in("state", ["proposed", "confirmed"])
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(1),
    ]);
    if (!c?.email) return { ok: false, message: "This client has no email address." };
    // Only the published, client-facing wording; never notes or transcripts.
    const nextUp = upcoming?.[0];
    const nextLine = nextUp
      ? `${formatSessionTime(nextUp.scheduled_at, nextUp.timezone)} · ${nextUp.duration_minutes} minutes${nextUp.state === "proposed" ? " (proposed)" : ""}${nextUp.location ? `\n${nextUp.location}` : ""}`
      : null;
    const content = opts.includeSummary ? clientFacingSummary((s.content ?? {}) as Record<string, unknown>, nextLine) : null;
    return {
      clientId: c.id,
      to: c.email,
      replyTo: meProfile?.email ?? null,
      dedupeKey: `summary:${s.id}`,
      refs: { summary_id: s.id, session_id: s.session_id },
      input: {
        kind,
        firstName: first(c.full_name),
        sessionLabel: sess ? formatSessionTime(sess.scheduled_at, sess.timezone).replace(/, \d{1,2}:\d{2} (GMT|BST)$/, "") : "our last session",
        coachName: meProfile?.full_name?.trim() || "Your coach",
        link: `${origin}/coaching/sessions/${s.session_id}`,
        note,
        content,
      },
    };
  }

  if (kind === "session_update") {
    const { data: sess } = await supabase
      .from("coaching_sessions")
      .select("id, client_id, scheduled_at, timezone, duration_minutes, state, location")
      .eq("id", refId)
      .maybeSingle();
    if (!sess) return { ok: false, message: "Session not found." };
    if (!["proposed", "confirmed", "cancelled"].includes(sess.state)) return { ok: false, message: "Only upcoming or cancelled sessions can be emailed about." };
    const { data: events } = await supabase
      .from("coaching_session_events")
      .select("id, kind, from_at, created_at")
      .eq("session_id", sess.id)
      .in("kind", ["created", "confirmed", "rescheduled", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(1);
    const latest = events?.[0];
    const change =
      sess.state === "cancelled" ? "cancelled" : latest?.kind === "rescheduled" ? "rescheduled" : sess.state === "proposed" ? "proposed" : "confirmed";
    const c = await client(sess.client_id);
    if (!c?.email) return { ok: false, message: "This client has no email address." };
    return {
      clientId: c.id,
      to: c.email,
      replyTo: meProfile?.email ?? null,
      // One email per change: a later move or cancellation can be emailed too.
      dedupeKey: `session:${sess.id}:${latest?.id ?? sess.state}`,
      refs: { session_id: sess.id },
      input: {
        kind,
        firstName: first(c.full_name),
        coachName: meProfile?.full_name?.trim() || "Your coach",
        change,
        when: formatSessionTime(sess.scheduled_at, sess.timezone),
        previousWhen: change === "rescheduled" && latest?.from_at ? formatSessionTime(latest.from_at, sess.timezone) : null,
        durationMinutes: sess.duration_minutes,
        location: sess.location,
        link: `${origin}/coaching`,
        note,
      },
    };
  }

  // Billing emails: billing admins only (the database enforces this too).
  const { data: billing } = await supabase.rpc("can_bill");
  if (billing !== true) return { ok: false, message: "Only the billing admin can send billing emails." };
  const { data: settings } = await supabase.from("billing_settings").select("trading_name, contact_email").eq("id", 1).maybeSingle();
  const supplierName = settings?.trading_name ?? "Aligned Media";

  if (kind === "invoice_issued") {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, client_id, status, number, total_pence, due_date, customer, supplier, payment_instructions")
      .eq("id", refId)
      .maybeSingle();
    if (!inv || inv.status !== "issued") return { ok: false, message: "Only an issued invoice can be emailed." };
    const c = await client(inv.client_id);
    const to = (inv.customer as { email?: string } | null)?.email || c?.email;
    if (!to) return { ok: false, message: "Add a billing email for this client first." };
    const pi = inv.payment_instructions as { account_name?: string; sort_code?: string; account_number?: string } | null;
    const { data: posRows } = await supabase.rpc("invoice_position", { p_invoice: inv.id });
    const pos = ((Array.isArray(posRows) ? posRows[0] : posRows) ?? { paid: 0, balance: inv.total_pence }) as { paid: number; balance: number };
    return {
      clientId: inv.client_id,
      to,
      replyTo: settings?.contact_email ?? null,
      dedupeKey: `invoice:${inv.id}`,
      refs: { invoice_id: inv.id },
      input: {
        kind,
        firstName: first((inv.customer as { name?: string } | null)?.name ?? c?.full_name),
        supplierName: (inv.supplier as { trading_name?: string } | null)?.trading_name ?? supplierName,
        number: inv.number!,
        total: formatPence(inv.total_pence),
        owed: pos.balance > 0 ? formatPence(pos.balance) : null,
        partPaid: pos.balance > 0 && pos.balance < inv.total_pence,
        due: ukDate(inv.due_date!),
        bank: pi ? { accountName: pi.account_name, sortCode: pi.sort_code, accountNumber: pi.account_number } : null,
        cardPayments: stripeStatus().ready,
        link: `${origin}/coaching`,
        note,
      },
    };
  }

  const { data: rec } = await supabase.from("receipts").select("id, client_id, status, amount_pence, received_on").eq("id", refId).maybeSingle();
  if (!rec || rec.status !== "confirmed") return { ok: false, message: "Payment not found." };
  const [{ data: allocs }, { data: unapplied }, c] = await Promise.all([
    supabase.from("receipt_allocations").select("amount_pence, invoices(number)").eq("receipt_id", rec.id).is("reversed_at", null),
    supabase.rpc("receipt_unapplied", { p_receipt: rec.id }),
    client(rec.client_id),
  ]);
  const { data: refunds } = await supabase.from("refunds").select("amount_pence, refunded_on").eq("receipt_id", rec.id).order("refunded_on");
  const { data: cust } = await supabase.from("billing_customers").select("name, email").eq("client_id", rec.client_id).maybeSingle();
  const to = cust?.email || c?.email;
  if (!to) return { ok: false, message: "Add a billing email for this client first." };
  return {
    clientId: rec.client_id,
    to,
    replyTo: settings?.contact_email ?? null,
    dedupeKey: `receipt:${rec.id}`,
    refs: { receipt_id: rec.id },
    input: {
      kind: "payment_received",
      firstName: first(cust?.name ?? c?.full_name),
      supplierName,
      amount: formatPence(rec.amount_pence),
      receivedOn: ukDate(rec.received_on),
      applied: ((allocs ?? []) as unknown as { amount_pence: number; invoices: { number: string } | null }[]).map((a) => ({
        number: a.invoices?.number ?? "",
        amount: formatPence(a.amount_pence),
      })),
      refunded: (refunds ?? []).map((r) => ({ amount: formatPence(r.amount_pence), on: ukDate(r.refunded_on) })),
      unapplied: (unapplied as number | null) ? formatPence(unapplied as number) : null,
      link: `${origin}/coaching`,
      note,
    },
  };
}

export async function previewMessage(kind: MessageKind, refId: string, note: string, opts: { includeSummary?: boolean } = {}) {
  const b = await build(kind, refId, note.trim() || null, opts);
  if ("ok" in b) return b;
  const m = buildMessage(b.input);
  return { ok: true as const, to: b.to, subject: m.subject, text: m.text, email: emailStatus() };
}

export async function sendMessage(input: { kind: MessageKind; refId: string; note: string; again?: boolean; includeSummary?: boolean }): Promise<{ ok: true; message: string } | Fail> {
  const me = await requireStaff();
  const status = emailStatus();
  if (!status.ready) return { ok: false, message: `${status.reason} Nothing was sent.` };
  const note = input.note.trim().slice(0, 1000) || null;
  const b = await build(input.kind, input.refId, note, { includeSummary: input.includeSummary });
  if ("ok" in b) return b;
  const m = buildMessage(b.input);
  const supabase = await createClient();
  const dedupeKey = input.again ? `${b.dedupeKey}:again:${Date.now()}` : b.dedupeKey;

  // Claim the email first; a repeat click or a second tab finds this row.
  let { data: job, error } = await supabase
    .from("message_jobs")
    .insert({
      client_id: b.clientId,
      kind: input.kind,
      dedupe_key: dedupeKey,
      to_email: b.to,
      subject: m.subject,
      body_text: m.text,
      personal_note: note,
      created_by: me.id,
      ...b.refs,
    })
    .select("id, status, sent_at, created_at, attempts")
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await supabase.from("message_jobs").select("id, status, sent_at, created_at, attempts").eq("dedupe_key", dedupeKey).single();
    if (existing?.status === "sent") return { ok: false, message: "This email was already sent. Use “Send again” if you mean to resend it." };
    if (existing?.status === "queued" && Date.now() - new Date(existing.created_at).getTime() < 120_000) {
      return { ok: false, message: "This email is already being sent." };
    }
    job = existing; // a failed or stuck attempt: try again on the same record
    error = null;
    await supabase.from("message_jobs").update({ status: "queued", to_email: b.to, subject: m.subject, body_text: m.text, personal_note: note, error: null }).eq("id", job!.id);
  }
  if (error || !job) return { ok: false, message: "Couldn’t prepare the email — nothing was sent. Try again." };

  const sent = await sendEmail({ to: b.to, subject: m.subject, text: m.text, html: m.html, replyTo: b.replyTo });
  await supabase
    .from("message_jobs")
    .update(
      sent.ok
        ? { status: "sent", sent_at: new Date().toISOString(), provider_id: sent.id, attempts: (job.attempts ?? 0) + 1 }
        : { status: "failed", error: sent.reason, attempts: (job.attempts ?? 0) + 1 }
    )
    .eq("id", job.id);
  if (input.kind === "invoice_issued") {
    await supabase.from("invoices").update({ delivery_status: sent.ok ? "sent" : "failed", delivery_error: sent.ok ? null : sent.reason }).eq("id", input.refId);
  }
  revalidatePath(`/coach/clients/${b.clientId}`, "layout");
  if (!sent.ok) return { ok: false, message: `The email didn’t send (${sent.reason}). Try again.` };
  return { ok: true, message: status.mode === "outbox" ? `Saved to the test outbox for ${b.to} (not really sent).` : `Sent to ${b.to}.` };
}

export async function getMessageJobs(clientId: string): Promise<MessageJob[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_jobs")
    .select("id, kind, dedupe_key, to_email, subject, status, error, session_id, summary_id, invoice_id, receipt_id, created_at, sent_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as MessageJob[];
}
