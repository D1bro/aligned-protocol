// End-to-end checks of the billing rules against the TEST project only.
// Signs in as the fictional test accounts (supabase/test-setup/test-accounts.local.md)
// and exercises invoices, payments, credit notes, refunds and session credits
// through the same database functions the app uses. Creates test records.
//
//   node scripts/billing-check.mjs
//
// Refuses to run against anything but aligned-test.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_REF = "yutrlsjitrjbteyukyfc";
const env = Object.fromEntries(
  readFileSync(".env.development.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url?.includes(TEST_REF)) {
  console.error("Refusing: .env.development.local does not point at the aligned-test project.");
  process.exit(1);
}
const accounts = Object.fromEntries(
  readFileSync("supabase/test-setup/test-accounts.local.md", "utf8")
    .split("\n")
    .filter((l) => l.includes("@example.com"))
    .map((l) => l.split("|").map((c) => c.trim()))
    .map((c) => [c[3], c[4]])
);

async function as(email) {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: accounts[email] });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "✔" : "✖"} ${label}`);
  if (!cond) failures++;
};
const fails = async (p, label, pattern) => {
  const { error } = await p;
  ok(!!error && (!pattern || pattern.test(error.message)), `${label}${error ? ` — “${error.message}”` : " — but it succeeded"}`);
};
const one = (d) => (Array.isArray(d) ? d[0] : d);
const run = `chk-${Date.now()}`;

const coach = await as("coach.test@example.com");
const sam = await as("sam.fictional@example.com");
const robin = await as("robin.unrelated@example.com");
const C = coach.c;

ok((await C.rpc("can_bill")).data === true, "test coach can bill");
ok((await sam.c.rpc("can_bill")).data === false, "a member can't bill");
await fails(sam.c.from("profiles").update({ can_manage_billing: true }).eq("id", sam.id).select("id").then((r) => (r.error ? r : { error: r.data?.length ? null : { message: "blocked" } })), "a member can't give themselves billing access");

// Clearly fictional settings — TEST PROJECT ONLY.
await C.from("billing_settings").update({
  legal_name: "TEST ONLY — Fictional Trader",
  address: "TEST ONLY\n1 Example Street\nNowhere",
  contact_email: "billing.test@example.com",
  bank_account_name: "TEST ONLY",
  bank_sort_code: "00-00-00",
  bank_account_number: "00000000",
}).eq("id", 1);
await C.from("billing_customers").upsert({ client_id: sam.id, name: "Sam Fictional", email: "sam.fictional@example.com" });

// Draft → issue -------------------------------------------------------------
const { data: inv } = await C.from("invoices").insert({ client_id: sam.id }).select("id, version").single();
const items = [{ description: "Focus Series — three sessions (test)", quantity: 3, unit_pence: 7500 }];
const v2 = await C.rpc("save_invoice_draft", { p_invoice: inv.id, p_expected_version: 1, p_items: items, p_discount: 0, p_credits: 3, p_service_period: "", p_notes: run, p_due_date: null });
ok(v2.data === 2, "draft saved (version 2)");
await fails(C.rpc("save_invoice_draft", { p_invoice: inv.id, p_expected_version: 1, p_items: items, p_discount: 0, p_credits: 3, p_service_period: "", p_notes: "stale", p_due_date: null }), "a stale draft save is refused", /changed elsewhere/);
await fails(C.rpc("save_invoice_draft", { p_invoice: inv.id, p_expected_version: 2, p_items: items, p_discount: 30000, p_credits: 3, p_service_period: "", p_notes: "", p_due_date: null }), "a discount bigger than the invoice is refused", /discount/);
ok((await sam.c.from("invoices").select("id").eq("id", inv.id)).data?.length === 0, "the member can't see a draft");

const [n1, n1again] = await Promise.all([C.rpc("issue_invoice", { p_invoice: inv.id }), C.rpc("issue_invoice", { p_invoice: inv.id })]);
ok(n1.data && n1.data === n1again.data, `issuing twice at once gives one number (${n1.data})`);
const { data: issued } = await C.from("invoices").select("*").eq("id", inv.id).single();
ok(issued.total_pence === 22500 && issued.supplier?.legal_name?.startsWith("TEST ONLY") && issued.customer?.name === "Sam Fictional", "issued: £225.00 with supplier and customer frozen");
ok(issued.tax_treatment === "not_registered", "tax treatment: not VAT registered");
await fails(C.from("invoices").update({ total_pence: 1 }).eq("id", inv.id), "an issued invoice can't be edited", /can't be changed/);
await fails(C.from("invoice_items").update({ unit_pence: 1 }).eq("invoice_id", inv.id), "an issued invoice's lines can't be edited", /can't be changed/);
await fails(C.from("invoices").delete().eq("id", inv.id), "an issued invoice can't be deleted", /kept for the record/);

const [a, b] = await Promise.all([
  C.from("invoices").insert({ client_id: sam.id, notes: run }).select("id").single(),
  C.from("invoices").insert({ client_id: sam.id, notes: run }).select("id").single(),
]);
for (const d of [a.data, b.data]) {
  await C.rpc("save_invoice_draft", { p_invoice: d.id, p_expected_version: 1, p_items: [{ description: "Test line", quantity: 1, unit_pence: 5000 }], p_discount: 0, p_credits: 0, p_service_period: "", p_notes: run, p_due_date: null });
}
const [na, nb] = await Promise.all([C.rpc("issue_invoice", { p_invoice: a.data.id }), C.rpc("issue_invoice", { p_invoice: b.data.id })]);
ok(na.data && nb.data && na.data !== nb.data, `two invoices issued at the same moment get different numbers (${na.data}, ${nb.data})`);

// Member visibility -----------------------------------------------------------
ok((await sam.c.from("invoices").select("id").eq("id", inv.id)).data?.length === 1, "the member sees their issued invoice");
ok((await robin.c.from("invoices").select("id").eq("client_id", sam.id)).data?.length === 0, "another member sees none of it");
await fails(sam.c.rpc("record_receipt", { p_client: sam.id, p_source: "bank_transfer", p_external_id: null, p_amount: 22500, p_currency: "GBP", p_received_on: "2026-10-15", p_reference: "", p_note: "", p_operation_key: `${run}-self` }), "a member can't record their own payment", /billing admin/);
await fails(robin.c.from("payment_notices").insert({ invoice_id: inv.id, client_id: robin.id }), "another member can't say they've paid someone else's invoice");

// Payments ------------------------------------------------------------------
const pos = async (id) => one((await C.rpc("invoice_position", { p_invoice: id })).data);
const credits = async () => one((await C.rpc("credit_position", { p_client: sam.id })).data);
const before = await credits();

const r1 = await C.rpc("record_receipt", { p_client: sam.id, p_source: "bank_transfer", p_external_id: null, p_amount: 10000, p_currency: "GBP", p_received_on: "2026-10-15", p_reference: n1.data, p_note: run, p_operation_key: `${run}-r1` });
const r1again = await C.rpc("record_receipt", { p_client: sam.id, p_source: "bank_transfer", p_external_id: null, p_amount: 10000, p_currency: "GBP", p_received_on: "2026-10-15", p_reference: n1.data, p_note: run, p_operation_key: `${run}-r1` });
ok(r1.data && r1.data === r1again.data, "recording the same payment twice keeps one record");
await fails(C.rpc("record_receipt", { p_client: sam.id, p_source: "bank_transfer", p_external_id: null, p_amount: 100, p_currency: "USD", p_received_on: "2026-10-15", p_reference: "", p_note: "", p_operation_key: `${run}-usd` }), "a non-GBP payment is refused", /GBP/);
ok((await C.rpc("allocate_receipt", { p_receipt: r1.data, p_invoice: inv.id, p_amount: 10000 })).data === 12500, "£100 part payment leaves £125 owed");
ok((await credits()).balance === before.balance, "no session credits for a part-paid invoice");

const r2 = await C.rpc("record_receipt", { p_client: sam.id, p_source: "bank_transfer", p_external_id: null, p_amount: 15000, p_currency: "GBP", p_received_on: "2026-10-16", p_reference: n1.data, p_note: run, p_operation_key: `${run}-r2` });
await fails(C.rpc("allocate_receipt", { p_receipt: r2.data, p_invoice: inv.id, p_amount: 15000 }), "can't allocate more than is owed", /still owed/);
ok((await C.rpc("allocate_receipt", { p_receipt: r2.data, p_invoice: inv.id, p_amount: 12500 })).data === 0, "the rest pays it in full");
ok((await C.rpc("receipt_unapplied", { p_receipt: r2.data })).data === 2500, "the £25 overpayment stays unallocated");
const after = await credits();
ok(after.balance === before.balance + 3, `paid in full: 3 session credits granted (now ${after.balance})`);
const p1 = await pos(inv.id);
ok(p1.paid === 22500 && p1.balance === 0, "invoice shows paid £225.00, nothing owed");
await fails(C.rpc("allocate_receipt", { p_receipt: r2.data, p_invoice: a.data.id, p_amount: 5000 }), "can't allocate more than is unallocated", /unallocated/);
ok((await sam.c.rpc("invoice_position", { p_invoice: inv.id })).data?.length === 1, "the member can see their invoice's position");
ok(((await robin.c.rpc("invoice_position", { p_invoice: inv.id })).data ?? []).length === 0, "another member can't");

// Refund and credit notes ----------------------------------------------------
await fails(C.rpc("record_refund", { p_receipt: r2.data, p_amount: 2600, p_reason: "test", p_refunded_on: "2026-10-16" }), "can't refund more than the unallocated £25", /unallocated/);
ok(!(await C.rpc("record_refund", { p_receipt: r2.data, p_amount: 2500, p_reason: "Overpaid (test)", p_refunded_on: "2026-10-16" })).error, "refund the £25 overpayment");
ok((await C.rpc("receipt_unapplied", { p_receipt: r2.data })).data === 0, "nothing left to refund");
await fails(C.rpc("issue_credit_note", { p_invoice: inv.id, p_amount: 100, p_reason: "test", p_credits_removed: 0 }), "no credit note on a paid invoice without reversing payments first", /up to £0.00/);
const cn = await C.rpc("issue_credit_note", { p_invoice: a.data.id, p_amount: 2000, p_reason: "Goodwill (test)", p_credits_removed: 0 });
ok(!!cn.data && (await pos(a.data.id)).balance === 3000, `credit note ${cn.data}: £50 invoice now £30 owed`);
await fails(C.rpc("issue_credit_note", { p_invoice: a.data.id, p_amount: 4000, p_reason: "test", p_credits_removed: 0 }), "credit note can't exceed what's owed", /up to £30.00/);
await fails(C.rpc("void_invoice", { p_invoice: inv.id, p_reason: "test" }), "can't void an invoice with payments", /Payments are allocated/);
ok(!(await C.rpc("void_invoice", { p_invoice: b.data.id, p_reason: "Issued in error (test)" })).error, "void an unpaid invoice");
await fails(C.rpc("allocate_receipt", { p_receipt: r1.data, p_invoice: b.data.id, p_amount: 100 }), "can't pay a void invoice", /issued invoice/);

// Reversals --------------------------------------------------------------------
const { data: alloc } = await C.from("receipt_allocations").select("id").eq("receipt_id", r1.data).is("reversed_at", null).single();
ok(!(await C.rpc("reverse_allocation", { p_allocation: alloc.id, p_reason: "Wrong invoice (test)" })).error, "undo an allocation");
ok((await pos(inv.id)).balance === 10000 && (await C.rpc("receipt_unapplied", { p_receipt: r1.data })).data === 10000, "the £100 is owed again and back to unallocated");
ok((await credits()).balance === after.balance, "credits already granted stay (flagged for a person to decide)");
await C.rpc("allocate_receipt", { p_receipt: r1.data, p_invoice: inv.id, p_amount: 10000 });
ok((await credits()).balance === after.balance, "re-paying it doesn't grant the credits a second time");

// Session credits -----------------------------------------------------------------
const book = async (state) =>
  (await C.from("coaching_sessions").insert({ client_id: sam.id, coach_id: coach.id, scheduled_at: new Date(Date.now() + 30 * 86400000).toISOString(), state, created_by: coach.id, location: run }).select("id").single()).data.id;
const res = async (sid) => (await C.from("session_reservations").select("status").eq("session_id", sid).maybeSingle()).data?.status ?? "none";
const c0 = await credits();
const s1 = await book("confirmed");
ok((await res(s1)) === "active" && (await credits()).available === c0.available - 1, "booking a confirmed session reserves a credit");
await C.from("coaching_sessions").update({ scheduled_at: new Date(Date.now() + 40 * 86400000).toISOString() }).eq("id", s1);
ok((await res(s1)) === "active" && (await credits()).available === c0.available - 1, "rescheduling keeps the same one reserved");
await C.from("coaching_sessions").update({ state: "cancelled" }).eq("id", s1);
ok((await res(s1)) === "released" && (await credits()).available === c0.available, "cancelling releases it");
const s2 = await book("confirmed");
await C.from("coaching_sessions").update({ state: "held", held_at: new Date().toISOString() }).eq("id", s2);
const c2 = await credits();
ok((await res(s2)) === "consumed" && c2.balance === c0.balance - 1 && c2.available === c0.available - 1, "holding the session uses the credit");
await C.from("coaching_sessions").update({ state: "confirmed" }).eq("id", s2);
await C.from("coaching_sessions").update({ state: "held" }).eq("id", s2);
ok((await credits()).balance === c2.balance, "marking it held again doesn't use a second credit");
const s3 = await book("confirmed");
await C.from("coaching_sessions").update({ state: "no_show" }).eq("id", s3);
ok((await res(s3)) === "active", "a no-show keeps the credit on hold until someone decides");
ok(!(await C.rpc("resolve_no_show_credit", { p_session: s3, p_use: false, p_reason: "" })).error && (await res(s3)) === "released", "deciding to give it back releases it");
await fails(sam.c.rpc("resolve_no_show_credit", { p_session: s3, p_use: true, p_reason: "" }), "a member can't decide a no-show", /billing admin/);

const k = `${run}-adj`;
await C.rpc("adjust_credits", { p_client: sam.id, p_quantity: 1, p_reason: "Complimentary session (test)", p_operation_key: k });
await C.rpc("adjust_credits", { p_client: sam.id, p_quantity: 1, p_reason: "Complimentary session (test)", p_operation_key: k });
ok((await credits()).balance === c2.balance + 1, "a credit adjustment counts once, even if sent twice");
await fails(C.rpc("adjust_credits", { p_client: sam.id, p_quantity: 1, p_reason: "", p_operation_key: `${k}-2` }), "an adjustment needs a reason", /reason/);
ok(((await robin.c.from("entitlement_ledger").select("id").eq("client_id", sam.id)).data ?? []).length === 0, "another member can't see Sam's credits");
ok(((await sam.c.from("entitlement_ledger").select("id").eq("client_id", sam.id)).data ?? []).length > 0, "Sam can see their own credits");

// Clear the test sessions out of the way so they don't clutter the coach's view.
await C.from("coaching_sessions").update({ state: "cancelled", cancel_reason: "billing check (test)" }).eq("location", run).in("state", ["proposed", "confirmed"]);

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll billing checks passed.");
process.exit(failures ? 1 : 0);
