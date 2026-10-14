"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/actions/admin";
import { parsePounds } from "@/lib/money";
import { looksLikeDuplicate, settingsGaps } from "@/lib/billing-status";
import { renderInvoicePdf, type InvoiceForPdf } from "@/lib/invoice-pdf";
import { createCheckout, stripeStatus } from "@/lib/stripe";

// Invoices, payments and session credits. Every change that touches money or
// credits is a database function (migration 0014) that checks the caller can
// bill and runs as one transaction; these actions only collect input, call
// it, and turn database errors into plain messages.

type Result = { ok: true; id?: string; number?: string; message?: string } | { ok: false; message: string };

// Database exceptions carry our own wording; anything else gets a generic line.
function why(error: { message?: string; code?: string } | null, fallback = "Couldn’t save — try again."): string {
  const m = error?.message ?? "";
  if (error?.code === "P0001" && m) return m;
  return fallback;
}

function refresh(clientId?: string) {
  if (clientId) revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach/billing");
  revalidatePath("/coaching");
}

// Whether the signed-in person may manage billing (false before 0014 is run).
export async function canBill(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_bill");
  return !error && data === true;
}

async function requireBilling() {
  const me = await requireAdmin();
  if (!(await canBill())) redirect("/coach");
  return me;
}

// Settings ---------------------------------------------------------------

export type BillingSettings = {
  trading_name: string;
  legal_name: string | null;
  legal_form: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  vat_status: "not_registered";
  currency: "GBP";
  invoice_prefix: string;
  credit_note_prefix: string;
  payment_terms_days: number;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_note: string | null;
  updated_at: string;
};

export async function getBillingSettings(): Promise<BillingSettings | null> {
  await requireBilling();
  const supabase = await createClient();
  const { data } = await supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle();
  return (data as BillingSettings | null) ?? null;
}

export async function saveBillingSettings(input: Record<string, string>): Promise<Result> {
  const me = await requireBilling();
  const t = (k: string, max = 300) => (input[k] ?? "").trim().slice(0, max) || null;
  const terms = Number(input.payment_terms_days);
  if (!Number.isInteger(terms) || terms < 0 || terms > 120) return { ok: false, message: "Payment terms must be 0–120 days." };
  const sort = t("bank_sort_code");
  if (sort && !/^\d{2}-?\d{2}-?\d{2}$/.test(sort)) return { ok: false, message: "Sort code should be six digits, like 12-34-56." };
  const acct = t("bank_account_number");
  if (acct && !/^\d{8}$/.test(acct)) return { ok: false, message: "Account number should be eight digits." };
  const prefix = t("invoice_prefix", 12) ?? "AM-";
  const cnPrefix = t("credit_note_prefix", 12) ?? "AM-CN-";
  if (prefix === cnPrefix) return { ok: false, message: "Invoices and credit notes need different prefixes." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_settings")
    .update({
      trading_name: t("trading_name", 120) ?? "Aligned Media",
      legal_name: t("legal_name", 200),
      legal_form: t("legal_form", 120),
      address: t("address", 600),
      contact_email: t("contact_email", 200),
      contact_phone: t("contact_phone", 60),
      invoice_prefix: prefix,
      credit_note_prefix: cnPrefix,
      payment_terms_days: terms,
      bank_account_name: t("bank_account_name", 120),
      bank_sort_code: sort ? sort.replace(/^(\d{2})-?(\d{2})-?(\d{2})$/, "$1-$2-$3") : null,
      bank_account_number: acct,
      bank_note: t("bank_note", 600),
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, message: why(error) };
  revalidatePath("/coach/billing");
  return { ok: true, message: "Saved. Invoices already issued keep the details they were issued with." };
}

// Reading -----------------------------------------------------------------

export type InvoiceItem = { id: string; position: number; description: string; quantity: number; unit_pence: number };
export type Invoice = {
  id: string;
  client_id: string;
  status: "draft" | "issued" | "void";
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  service_period: string | null;
  notes: string | null;
  supplier: InvoiceForPdf["supplier"] | null;
  customer: InvoiceForPdf["customer"] | null;
  payment_instructions: InvoiceForPdf["payment_instructions"] | null;
  discount_pence: number;
  subtotal_pence: number;
  total_pence: number;
  credits_purchased: number;
  pdf_status: "none" | "pending" | "ready" | "failed";
  pdf_error: string | null;
  payment_link_url: string | null;
  payment_link_at: string | null;
  void_reason: string | null;
  version: number;
  created_at: string;
  items: InvoiceItem[];
  paid_pence: number;
  credited_pence: number;
  balance_pence: number;
};
export type Receipt = {
  id: string;
  source: "bank_transfer" | "payment_link";
  amount_pence: number;
  received_on: string;
  reference: string | null;
  note: string | null;
  status: "confirmed" | "reversed";
  reverse_reason: string | null;
  confirmed_at: string;
  unapplied_pence: number;
  allocations: { id: string; invoice_id: string; amount_pence: number; created_at: string; reversed_at: string | null; reverse_reason: string | null }[];
};
export type ClientBilling = {
  available: boolean;
  canBill: boolean;
  customer: { name: string; email: string | null; address: string | null } | null;
  invoices: Invoice[];
  receipts: Receipt[];
  creditNotes: { id: string; invoice_id: string; number: string; amount_pence: number; credits_removed: number; reason: string; issued_at: string }[];
  refunds: { id: string; receipt_id: string; amount_pence: number; reason: string; refunded_on: string }[];
  ledger: { id: string; kind: string; quantity: number; invoice_id: string | null; session_id: string | null; reason: string | null; created_at: string }[];
  credits: { balance: number; reserved: number; available: number };
  reservations: { session_id: string; status: "active" | "consumed" | "released" }[];
  notices: { id: string; invoice_id: string; note: string | null; status: string; created_at: string }[];
  settingsGaps: string[];
  stripe: { ready: boolean; reason?: string };
};

const NO_CREDITS = { balance: 0, reserved: 0, available: 0 };

// Coaches see a client's session credits; billing admins see everything.
export async function getClientBilling(clientId: string): Promise<ClientBilling> {
  await requireStaff();
  const supabase = await createClient();
  const empty: ClientBilling = {
    available: false, canBill: false, customer: null, invoices: [], receipts: [], creditNotes: [], refunds: [], ledger: [],
    credits: NO_CREDITS, reservations: [], notices: [], settingsGaps: [], stripe: stripeStatus(),
  };
  const [{ data: pos, error: posErr }, { data: reservations }] = await Promise.all([
    supabase.rpc("credit_position", { p_client: clientId }),
    supabase.from("session_reservations").select("session_id, status").eq("client_id", clientId),
  ]);
  if (posErr) return empty;
  const credits = (Array.isArray(pos) ? pos[0] : pos) ?? NO_CREDITS;
  const billing = await canBill();
  if (!billing) return { ...empty, available: true, credits, reservations: (reservations ?? []) as ClientBilling["reservations"] };

  const [customer, invoices, items, list, receipts, allocs, notes, refunds, ledger, notices, settings] = await Promise.all([
    supabase.from("billing_customers").select("name, email, address").eq("client_id", clientId).maybeSingle(),
    supabase.from("invoices").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("invoice_items").select("id, invoice_id, position, description, quantity, unit_pence, invoices!inner(client_id)").eq("invoices.client_id", clientId).order("position"),
    supabase.rpc("billing_invoice_list"),
    supabase.from("receipts").select("*").eq("client_id", clientId).order("received_on", { ascending: false }),
    supabase.from("receipt_allocations").select("id, receipt_id, invoice_id, amount_pence, created_at, reversed_at, reverse_reason, receipts!inner(client_id)").eq("receipts.client_id", clientId).order("created_at"),
    supabase.from("credit_notes").select("id, invoice_id, number, amount_pence, credits_removed, reason, issued_at").eq("client_id", clientId).order("issued_at"),
    supabase.from("refunds").select("id, receipt_id, amount_pence, reason, refunded_on").eq("client_id", clientId).order("created_at"),
    supabase.from("entitlement_ledger").select("id, kind, quantity, invoice_id, session_id, reason, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("payment_notices").select("id, invoice_id, note, status, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const position = new Map(((list.data ?? []) as { id: string; paid_pence: number; credited_pence: number; balance_pence: number }[]).map((r) => [r.id, r]));
  const unapplied = await Promise.all(
    ((receipts.data ?? []) as { id: string }[]).map(async (r) => {
      const { data } = await supabase.rpc("receipt_unapplied", { p_receipt: r.id });
      return [r.id, (data as number | null) ?? 0] as const;
    })
  );
  const unappliedBy = new Map(unapplied);
  const allAllocs = (allocs.data ?? []) as (Receipt["allocations"][number] & { receipt_id: string })[];

  return {
    available: true,
    canBill: true,
    customer: (customer.data as ClientBilling["customer"]) ?? null,
    invoices: ((invoices.data ?? []) as Omit<Invoice, "items" | "paid_pence" | "credited_pence" | "balance_pence">[]).map((inv) => ({
      ...inv,
      items: ((items.data ?? []) as (InvoiceItem & { invoice_id: string })[]).filter((i) => i.invoice_id === inv.id),
      paid_pence: position.get(inv.id)?.paid_pence ?? 0,
      credited_pence: position.get(inv.id)?.credited_pence ?? 0,
      balance_pence: position.get(inv.id)?.balance_pence ?? inv.total_pence,
    })),
    receipts: ((receipts.data ?? []) as Omit<Receipt, "unapplied_pence" | "allocations">[]).map((r) => ({
      ...r,
      unapplied_pence: r.status === "confirmed" ? unappliedBy.get(r.id) ?? 0 : 0,
      allocations: allAllocs.filter((a) => a.receipt_id === r.id),
    })),
    creditNotes: (notes.data ?? []) as ClientBilling["creditNotes"],
    refunds: (refunds.data ?? []) as ClientBilling["refunds"],
    ledger: (ledger.data ?? []) as ClientBilling["ledger"],
    credits,
    reservations: (reservations ?? []) as ClientBilling["reservations"],
    notices: (notices.data ?? []) as ClientBilling["notices"],
    settingsGaps: settingsGaps((settings.data as BillingSettings | null) ?? null),
    stripe: stripeStatus(),
  };
}

export type TrackerRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  status: "draft" | "issued" | "void";
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_pence: number;
  paid_pence: number;
  credited_pence: number;
  balance_pence: number;
  pdf_status: string;
  delivery_status: string;
  created_at: string;
  notices: number;
};

export async function getInvoiceTracker(): Promise<TrackerRow[] | null> {
  await requireBilling();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_invoice_list");
  if (error) return null;
  return (data ?? []) as TrackerRow[];
}

// Customers and drafts ----------------------------------------------------

export async function saveCustomer(input: { clientId: string; name: string; email: string; address: string }): Promise<Result> {
  await requireBilling();
  const name = input.name.trim().slice(0, 200);
  if (!name) return { ok: false, message: "Add the name to bill." };
  const supabase = await createClient();
  const { error } = await supabase.from("billing_customers").upsert({
    client_id: input.clientId,
    name,
    email: input.email.trim().slice(0, 200) || null,
    address: input.address.trim().slice(0, 600) || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function createDraftInvoice(clientId: string): Promise<Result> {
  const me = await requireBilling();
  const supabase = await createClient();
  // Start the billing name from their profile; it's checked before issue.
  const { data: existing } = await supabase.from("billing_customers").select("client_id").eq("client_id", clientId).maybeSingle();
  if (!existing) {
    const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", clientId).maybeSingle();
    if (prof?.full_name?.trim()) {
      await supabase.from("billing_customers").insert({ client_id: clientId, name: prof.full_name.trim(), email: prof.email });
    }
  }
  const { data, error } = await supabase.from("invoices").insert({ client_id: clientId, created_by: me.id }).select("id").single();
  if (error || !data) return { ok: false, message: why(error) };
  refresh(clientId);
  return { ok: true, id: data.id };
}

export async function saveDraftInvoice(input: {
  invoiceId: string;
  clientId: string;
  version: number;
  items: { description: string; quantity: number; unit: string }[];
  discount: string;
  credits: number;
  servicePeriod: string;
  notes: string;
  dueDate: string;
}): Promise<Result & { version?: number }> {
  await requireBilling();
  const items = [];
  for (const [i, it] of input.items.entries()) {
    if (!it.description.trim() && !it.unit.trim()) continue;
    const unit = parsePounds(it.unit);
    if (!it.description.trim()) return { ok: false, message: `Line ${i + 1} needs a description.` };
    if (unit === null) return { ok: false, message: `Line ${i + 1}: enter the price in pounds, like 75 or 75.00.` };
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 1000) return { ok: false, message: `Line ${i + 1}: quantity must be a whole number.` };
    items.push({ description: it.description.trim().slice(0, 300), quantity: it.quantity, unit_pence: unit });
  }
  const discount = input.discount.trim() ? parsePounds(input.discount) : 0;
  if (discount === null) return { ok: false, message: "Enter the discount in pounds, or leave it empty." };
  if (!Number.isInteger(input.credits) || input.credits < 0 || input.credits > 100) return { ok: false, message: "Session credits must be 0–100." };
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { ok: false, message: "Choose a valid due date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_invoice_draft", {
    p_invoice: input.invoiceId,
    p_expected_version: input.version,
    p_items: items,
    p_discount: discount,
    p_credits: input.credits,
    p_service_period: input.servicePeriod.slice(0, 200),
    p_notes: input.notes.slice(0, 2000),
    p_due_date: input.dueDate || null,
  });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true, version: data as number };
}

export async function deleteDraftInvoice(invoiceId: string, clientId: string): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("status", "draft").select("id");
  if (error) return { ok: false, message: why(error) };
  if (!data?.length) return { ok: false, message: "Only a draft can be deleted." };
  refresh(clientId);
  return { ok: true };
}

// Issuing -----------------------------------------------------------------

export async function issueInvoice(invoiceId: string, clientId: string): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", { p_invoice: invoiceId });
  if (error) return { ok: false, message: why(error, "Couldn’t issue — nothing was numbered. Try again.") };
  const pdf = await makeInvoicePdf(invoiceId);
  refresh(clientId);
  return {
    ok: true,
    number: data as string,
    message: pdf.ok ? undefined : "Issued, but the PDF didn’t generate. Use “Retry PDF”.",
  };
}

// Build the PDF from the frozen snapshot and store it privately. Safe to retry.
export async function makeInvoicePdf(invoiceId: string): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv || inv.status === "draft") return { ok: false, message: "Only an issued invoice has a PDF." };
  const { data: items } = await supabase.from("invoice_items").select("description, quantity, unit_pence").eq("invoice_id", invoiceId).order("position");
  const path = `${inv.client_id}/${inv.id}.pdf`;
  try {
    const bytes = await renderInvoicePdf({ ...(inv as InvoiceForPdf), items: (items ?? []) as InvoiceForPdf["items"] });
    const { error: upErr } = await supabase.storage.from("invoices").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);
    await supabase.from("invoices").update({ pdf_status: "ready", pdf_path: path, pdf_error: null }).eq("id", invoiceId);
    revalidatePath(`/coach/clients/${inv.client_id}`);
    return { ok: true };
  } catch (e) {
    await supabase
      .from("invoices")
      .update({ pdf_status: "failed", pdf_error: e instanceof Error ? e.message.slice(0, 300) : "PDF failed" })
      .eq("id", invoiceId);
    revalidatePath(`/coach/clients/${inv.client_id}`);
    return { ok: false, message: "The PDF didn’t generate. Try again." };
  }
}

export async function voidInvoice(invoiceId: string, clientId: string, reason: string): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice: invoiceId, p_reason: reason });
  if (error) return { ok: false, message: why(error) };
  refresh(clientId);
  return { ok: true };
}

// A Stripe Checkout page for what's still owed (test mode only).
export async function createPaymentLink(invoiceId: string, clientId: string): Promise<Result & { url?: string }> {
  await requireBilling();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("id, client_id, status, number, customer").eq("id", invoiceId).maybeSingle();
  if (!inv || inv.status !== "issued") return { ok: false, message: "Only an issued invoice can be paid by card." };
  const { data: pos } = await supabase.rpc("invoice_position", { p_invoice: invoiceId });
  const balance = ((Array.isArray(pos) ? pos[0] : pos) as { balance: number } | null)?.balance ?? 0;
  if (balance <= 0) return { ok: false, message: "Nothing is owed on this invoice." };
  const r = await createCheckout({
    invoiceId,
    clientId: inv.client_id,
    number: inv.number!,
    amountPence: balance,
    customerEmail: (inv.customer as { email?: string } | null)?.email ?? null,
    returnUrl: `${await origin()}/coaching`,
  });
  if (!r.ok) return r;
  await supabase.from("invoices").update({ payment_link_url: r.url, payment_link_at: new Date().toISOString() }).eq("id", invoiceId);
  refresh(clientId);
  return { ok: true, url: r.url };
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.the-aligned.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Payments ----------------------------------------------------------------

export async function recordBankPayment(input: {
  clientId: string;
  amount: string;
  receivedOn: string;
  reference: string;
  note: string;
  operationKey: string;
  allocateTo: string | null;
  allowDuplicate: boolean;
}): Promise<Result & { duplicate?: { amount_pence: number; received_on: string; reference: string | null } }> {
  await requireBilling();
  const amount = parsePounds(input.amount);
  if (!amount) return { ok: false, message: "Enter the amount received, like 225 or 225.00." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) return { ok: false, message: "Choose the date it arrived." };
  if (!/^[\w-]{8,80}$/.test(input.operationKey)) return { ok: false, message: "Reload the page and try again." };
  const supabase = await createClient();
  if (!input.allowDuplicate) {
    const { data: recent } = await supabase
      .from("receipts")
      .select("amount_pence, received_on, reference, operation_key")
      .eq("client_id", input.clientId)
      .eq("status", "confirmed");
    const dup = (recent ?? []).find(
      (r) => r.operation_key !== input.operationKey && looksLikeDuplicate(r, { amount_pence: amount, received_on: input.receivedOn, reference: input.reference || null })
    );
    if (dup) return { ok: false, message: "This looks like a payment that’s already recorded.", duplicate: dup };
  }
  const { data: receiptId, error } = await supabase.rpc("record_receipt", {
    p_client: input.clientId,
    p_source: "bank_transfer",
    p_external_id: null,
    p_amount: amount,
    p_currency: "GBP",
    p_received_on: input.receivedOn,
    p_reference: input.reference,
    p_note: input.note,
    p_operation_key: input.operationKey,
  });
  if (error) return { ok: false, message: why(error) };
  let message: string | undefined;
  if (input.allocateTo) {
    const { data: pos } = await supabase.rpc("invoice_position", { p_invoice: input.allocateTo });
    const balance = ((Array.isArray(pos) ? pos[0] : pos) as { balance: number } | null)?.balance ?? 0;
    const unapplied = ((await supabase.rpc("receipt_unapplied", { p_receipt: receiptId })).data as number | null) ?? 0;
    const put = Math.min(balance, unapplied);
    if (put > 0) {
      const { error: aErr } = await supabase.rpc("allocate_receipt", { p_receipt: receiptId, p_invoice: input.allocateTo, p_amount: put });
      if (aErr) message = `Payment recorded, but not allocated: ${why(aErr)}`;
    }
    if (amount > put && !message) message = "Payment recorded. The extra is kept as unallocated money on their account.";
  }
  refresh(input.clientId);
  return { ok: true, id: receiptId as string, message };
}

export async function allocatePayment(input: { receiptId: string; invoiceId: string; amount: string; clientId: string }): Promise<Result> {
  await requireBilling();
  const amount = parsePounds(input.amount);
  if (!amount) return { ok: false, message: "Enter an amount in pounds." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("allocate_receipt", { p_receipt: input.receiptId, p_invoice: input.invoiceId, p_amount: amount });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function reverseAllocation(input: { allocationId: string; reason: string; clientId: string }): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_allocation", { p_allocation: input.allocationId, p_reason: input.reason });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function reversePayment(input: { receiptId: string; reason: string; clientId: string }): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_receipt", { p_receipt: input.receiptId, p_reason: input.reason });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function issueCreditNote(input: { invoiceId: string; amount: string; reason: string; creditsRemoved: number; clientId: string }): Promise<Result> {
  await requireBilling();
  const amount = parsePounds(input.amount);
  if (!amount) return { ok: false, message: "Enter the amount to credit in pounds." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_credit_note", {
    p_invoice: input.invoiceId,
    p_amount: amount,
    p_reason: input.reason,
    p_credits_removed: input.creditsRemoved,
  });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true, number: data as string };
}

export async function recordRefund(input: { receiptId: string; amount: string; reason: string; refundedOn: string; clientId: string }): Promise<Result> {
  await requireBilling();
  const amount = parsePounds(input.amount);
  if (!amount) return { ok: false, message: "Enter the amount refunded in pounds." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.refundedOn)) return { ok: false, message: "Choose the date it was refunded." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_refund", {
    p_receipt: input.receiptId,
    p_amount: amount,
    p_reason: input.reason,
    p_refunded_on: input.refundedOn,
  });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function markNotice(input: { noticeId: string; status: "matched" | "not_found"; clientId: string }): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { error } = await supabase.from("payment_notices").update({ status: input.status }).eq("id", input.noticeId);
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

// Session credits -----------------------------------------------------------

export async function adjustCredits(input: { clientId: string; quantity: number; reason: string; operationKey: string }): Promise<Result> {
  await requireBilling();
  if (!/^[\w-]{8,80}$/.test(input.operationKey)) return { ok: false, message: "Reload the page and try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_credits", {
    p_client: input.clientId,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_operation_key: `adjust:${input.operationKey}`,
  });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

export async function resolveNoShowCredit(input: { sessionId: string; use: boolean; reason: string; clientId: string }): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_no_show_credit", { p_session: input.sessionId, p_use: input.use, p_reason: input.reason });
  if (error) return { ok: false, message: why(error) };
  refresh(input.clientId);
  return { ok: true };
}

// The member's side -----------------------------------------------------------

export type MyBilling = {
  available: boolean;
  invoices: (Pick<Invoice, "id" | "status" | "number" | "issue_date" | "due_date" | "total_pence" | "pdf_status" | "payment_instructions" | "credits_purchased" | "void_reason"> & {
    paid_pence: number;
    credited_pence: number;
    balance_pence: number;
    noticeSent: boolean;
  })[];
  credits: { balance: number; reserved: number; available: number };
  cardPayments: boolean;
};

export async function getMyBilling(): Promise<MyBilling> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empty: MyBilling = { available: false, invoices: [], credits: NO_CREDITS, cardPayments: false };
  if (!user) return empty;
  const [{ data: invoices, error }, { data: pos }, { data: notices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, number, issue_date, due_date, total_pence, pdf_status, payment_instructions, credits_purchased, void_reason")
      .eq("client_id", user.id)
      .neq("status", "draft")
      .order("issue_date", { ascending: false }),
    supabase.rpc("credit_position", { p_client: user.id }),
    supabase.from("payment_notices").select("invoice_id, status").eq("client_id", user.id),
  ]);
  if (error) return empty;
  const rows = await Promise.all(
    (invoices ?? []).map(async (inv) => {
      const { data } = await supabase.rpc("invoice_position", { p_invoice: inv.id });
      const p = ((Array.isArray(data) ? data[0] : data) ?? { paid: 0, credited: 0, balance: inv.total_pence }) as { paid: number; credited: number; balance: number };
      return {
        ...(inv as MyBilling["invoices"][number]),
        paid_pence: p.paid,
        credited_pence: p.credited,
        balance_pence: Math.max(p.balance, 0),
        noticeSent: (notices ?? []).some((n) => n.invoice_id === inv.id && n.status === "new"),
      };
    })
  );
  return {
    available: true,
    invoices: rows,
    credits: (Array.isArray(pos) ? pos[0] : pos) ?? NO_CREDITS,
    cardPayments: stripeStatus().ready,
  };
}

// "I've paid by bank transfer": tells Duane to check. Not proof of payment.
export async function tellCoachIPaid(invoiceId: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { error } = await supabase
    .from("payment_notices")
    .insert({ invoice_id: invoiceId, client_id: user.id, note: note.trim().slice(0, 500) || null });
  if (error) return { ok: false, message: "Couldn’t send — try again." };
  revalidatePath("/coaching");
  return { ok: true };
}

// Pay what's owed by card (Stripe test mode). The payment only counts once
// Stripe confirms it to our webhook.
export async function payInvoiceByCard(invoiceId: string): Promise<Result & { url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { data: inv } = await supabase.from("invoices").select("id, client_id, status, number").eq("id", invoiceId).maybeSingle();
  if (!inv || inv.client_id !== user.id || inv.status !== "issued") return { ok: false, message: "This invoice can’t be paid online." };
  const { data: pos } = await supabase.rpc("invoice_position", { p_invoice: invoiceId });
  const balance = ((Array.isArray(pos) ? pos[0] : pos) as { balance: number } | null)?.balance ?? 0;
  if (balance <= 0) return { ok: false, message: "Nothing is owed on this invoice." };
  return createCheckout({
    invoiceId,
    clientId: user.id,
    number: inv.number!,
    amountPence: balance,
    customerEmail: user.email ?? null,
    returnUrl: `${await origin()}/coaching`,
  });
}
