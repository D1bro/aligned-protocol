// The billing rules in the database itself (migration 0014): numbering,
// frozen invoices, payments and balances, credit notes, refunds, voids, and
// session credits moving with sessions. Runs against an in-memory Postgres.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asOwner, asUser, asService, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let biller: string, coach: string, sam: string, robin: string;
let inv1: string;

const position = async (id: string) =>
  (await db.query<{ total: number; paid: number; credited: number; balance: number }>(`select * from public.invoice_position($1)`, [id])).rows[0];
const credits = async (client: string) =>
  (await db.query<{ balance: number; reserved: number; available: number }>(`select * from public.credit_position($1)`, [client])).rows[0];
const receipt = (key: string, amount: number, client = sam) =>
  val<string>(db, `select public.record_receipt($1, 'bank_transfer', null, $2, 'GBP', '2026-10-15', 'ref', null, $3)`, [client, amount, key]);
const draft = async (client: string, items: object[], credits = 0, discount = 0) => {
  const id = await val<string>(db, `insert into public.invoices (client_id) values ($1) returning id`, [client]);
  await db.query(`select public.save_invoice_draft($1, 1, $2::jsonb, $3, $4, '', '', null)`, [id, JSON.stringify(items), discount, credits]);
  return id;
};
const session = async (state: string) =>
  val<string>(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now() + interval '7 days', $3, $2) returning id`, [sam, biller, state]);
const reservation = (sid: string) => val<string>(db, `select status from public.session_reservations where session_id = $1`, [sid]);

before(async () => {
  db = await freshDb();
  biller = await makeUser(db, "biller@example.com", "admin", "Bea Biller");
  coach = await makeUser(db, "coach@example.com", "coach", "Cal Coach");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [biller]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [biller, sam]);
});

test("only an admin given billing access can bill; a member can't grant it to themselves", async () => {
  await asUser(db, biller);
  assert.equal(await val(db, `select public.can_bill()`), true);
  await asUser(db, coach);
  assert.equal(await val(db, `select public.can_bill()`), false);
  await asUser(db, sam);
  assert.equal(await val(db, `select public.can_bill()`), false);
  assert.match((await errorOf(db, `update public.profiles set can_manage_billing = true where id = $1`, [sam]))!, /can't be changed/);
  await asUser(db, coach);
  assert.match((await errorOf(db, `select public.issue_invoice(gen_random_uuid())`))!, /billing admin/);
});

test("an invoice can't be issued until the business and bank details are filled in", async () => {
  await asUser(db, biller);
  inv1 = await draft(sam, [{ description: "Focus Series — three sessions", quantity: 3, unit_pence: 7500 }], 3);
  const err = await errorOf(db, `select public.issue_invoice($1)`, [inv1]);
  assert.match(err!, /legal name/);
  assert.match(err!, /bank details/);
  assert.match(err!, /billing name/);
  assert.equal(await val(db, `select last_number from public.billing_counters where kind = 'invoice'`), 0, "no number used up");
  await db.query(`update public.billing_settings set legal_name = 'Fictional Trader', address = '1 Example St', contact_email = 'b@example.com',
                  bank_account_name = 'Fictional', bank_sort_code = '00-00-00', bank_account_number = '00000000' where id = 1`);
  await db.query(`insert into public.billing_customers (client_id, name, email) values ($1, 'Sam Fictional', 'sam@example.com')`, [sam]);
});

test("a stale draft save is refused; a discount can't exceed the lines", async () => {
  await asUser(db, biller);
  assert.match((await errorOf(db, `select public.save_invoice_draft($1, 1, '[]'::jsonb, 0, 0, '', '', null)`, [inv1]))!, /changed elsewhere/);
  assert.match((await errorOf(db, `select public.save_invoice_draft($1, 2, $2::jsonb, 30000, 3, '', '', null)`, [inv1, JSON.stringify([{ description: "x", quantity: 3, unit_pence: 7500 }])]))!, /discount/);
});

test("issuing numbers, snapshots and freezes the invoice; issuing again changes nothing", async () => {
  await asUser(db, biller);
  const n = await val<string>(db, `select public.issue_invoice($1)`, [inv1]);
  assert.equal(n, "AM-0001");
  assert.equal(await val(db, `select public.issue_invoice($1)`, [inv1]), "AM-0001");
  const row = (await db.query<Record<string, any>>(`select * from public.invoices where id = $1`, [inv1])).rows[0];
  assert.equal(row.total_pence, 22500);
  assert.equal(row.tax_treatment, "not_registered");
  assert.equal(row.supplier.legal_name, "Fictional Trader");
  assert.equal(row.customer.name, "Sam Fictional");
  assert.equal(row.payment_instructions.sort_code, "00-00-00");
  // Later settings changes don't touch it.
  await db.query(`update public.billing_settings set legal_name = 'Changed' where id = 1`);
  assert.equal(await val(db, `select supplier->>'legal_name' from public.invoices where id = $1`, [inv1]), "Fictional Trader");
  await db.query(`update public.billing_settings set legal_name = 'Fictional Trader' where id = 1`);
  assert.match((await errorOf(db, `update public.invoices set total_pence = 1 where id = $1`, [inv1]))!, /can't be changed/);
  assert.match((await errorOf(db, `update public.invoice_items set unit_pence = 1 where invoice_id = $1`, [inv1]))!, /can't be changed/);
  assert.match((await errorOf(db, `delete from public.invoices where id = $1`, [inv1]))!, /kept for the record/);
  // Updating delivery or PDF status is still fine.
  assert.equal(await errorOf(db, `update public.invoices set pdf_status = 'ready' where id = $1`, [inv1]), null);
});

test("members see only their own issued invoices", async () => {
  await asUser(db, biller);
  const d = await draft(sam, [{ description: "Draft only", quantity: 1, unit_pence: 100 }]);
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.invoices`), 1);
  assert.equal(await val(db, `select count(*)::int from public.invoices where id = $1`, [d]), 0);
  assert.equal(await val(db, `select count(*)::int from public.invoice_items where invoice_id = $1`, [inv1]), 1);
  assert.equal((await position(inv1)).balance, 22500);
  assert.match((await errorOf(db, `select public.record_receipt($1, 'bank_transfer', null, 22500, 'GBP', '2026-10-15', '', '', 'self')`, [sam]))!, /billing admin/);
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.invoices`), 0);
  assert.equal(await position(inv1), undefined);
  assert.ok(await errorOf(db, `insert into public.payment_notices (invoice_id, client_id) values ($1, $2)`, [inv1, robin]));
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.payment_notices (invoice_id, client_id, note) values ($1, $2, 'sent Monday')`, [inv1, sam]), null);
  await asUser(db, biller);
  await db.query(`delete from public.invoices where id = $1`, [d]);
});

test("part payment, then full payment: credits granted once, overpayment kept unallocated", async () => {
  await asUser(db, biller);
  const before = await credits(sam);
  const r1 = await receipt("op-r1", 10000);
  assert.equal(await receipt("op-r1", 10000), r1, "same operation, same record");
  assert.equal(await val(db, `select public.allocate_receipt($1, $2, 10000)`, [r1, inv1]), 12500);
  assert.equal((await credits(sam)).balance, before.balance, "nothing granted while part paid");

  const r2 = await receipt("op-r2", 15000);
  assert.match((await errorOf(db, `select public.allocate_receipt($1, $2, 15000)`, [r2, inv1]))!, /Only £125.00 is still owed/);
  assert.equal(await val(db, `select public.allocate_receipt($1, $2, 12500)`, [r2, inv1]), 0);
  assert.equal(await val(db, `select public.receipt_unapplied($1)`, [r2]), 2500);
  assert.deepEqual(await position(inv1), { total: 22500, paid: 22500, credited: 0, balance: 0 });
  assert.equal((await credits(sam)).balance, before.balance + 3);
  assert.match((await errorOf(db, `select public.record_receipt($1, 'bank_transfer', null, 100, 'USD', '2026-10-15', '', '', 'usd')`, [sam]))!, /GBP/);
});

test("a payment can't go against another client's invoice", async () => {
  await asUser(db, biller);
  const r = await receipt("op-robin", 5000, robin);
  assert.match((await errorOf(db, `select public.allocate_receipt($1, $2, 100)`, [r, inv1]))!, /different client/);
});

test("refunds come only from unallocated money", async () => {
  await asUser(db, biller);
  const r2 = await val<string>(db, `select id from public.receipts where operation_key = 'op-r2'`);
  assert.match((await errorOf(db, `select public.record_refund($1, 2600, 'too much', '2026-10-16')`, [r2]))!, /Only £25.00/);
  assert.match((await errorOf(db, `select public.record_refund($1, 2500, '', '2026-10-16')`, [r2]))!, /reason/);
  assert.equal(await errorOf(db, `select public.record_refund($1, 2500, 'Overpaid', '2026-10-16')`, [r2]), null);
  assert.equal(await val(db, `select public.receipt_unapplied($1)`, [r2]), 0);
});

test("credit notes reduce what's owed, never below zero, with their own numbers", async () => {
  await asUser(db, biller);
  assert.match((await errorOf(db, `select public.issue_credit_note($1, 100, 'x', 0)`, [inv1]))!, /up to £0.00/);
  const inv2 = await draft(sam, [{ description: "One session", quantity: 1, unit_pence: 5000 }]);
  assert.equal(await val(db, `select public.issue_invoice($1)`, [inv2]), "AM-0002");
  assert.equal(await val(db, `select public.issue_credit_note($1, 2000, 'Goodwill', 0)`, [inv2]), "AM-CN-0001");
  assert.deepEqual(await position(inv2), { total: 5000, paid: 0, credited: 2000, balance: 3000 });
  assert.match((await errorOf(db, `select public.issue_credit_note($1, 4000, 'x', 0)`, [inv2]))!, /up to £30.00/);
  assert.match((await errorOf(db, `select public.issue_credit_note($1, 100, 'x', 1)`, [inv2]))!, /0 session credit/);
});

test("a credit note that settles a part-paid invoice grants its sessions, net of any removed", async () => {
  await asUser(db, biller);
  const inv3 = await draft(sam, [{ description: "Two sessions", quantity: 2, unit_pence: 7500 }], 2);
  await db.query(`select public.issue_invoice($1)`, [inv3]);
  const r = await receipt("op-r3", 7500);
  await db.query(`select public.allocate_receipt($1, $2, 7500)`, [r, inv3]);
  const before = (await credits(sam)).balance;
  await db.query(`select public.issue_credit_note($1, 7500, 'Only one session went ahead', 1)`, [inv3]);
  assert.equal((await position(inv3)).balance, 0);
  assert.equal((await credits(sam)).balance, before + 2 - 1);
});

test("voids: only unpaid invoices, kept on record, can't be paid after", async () => {
  await asUser(db, biller);
  assert.match((await errorOf(db, `select public.void_invoice($1, 'x')`, [inv1]))!, /Payments are allocated/);
  const inv4 = await draft(sam, [{ description: "Wrong", quantity: 1, unit_pence: 1000 }]);
  await db.query(`select public.issue_invoice($1)`, [inv4]);
  assert.match((await errorOf(db, `select public.void_invoice($1, '')`, [inv4]))!, /reason/);
  await db.query(`select public.void_invoice($1, 'Issued in error')`, [inv4]);
  assert.equal(await val(db, `select status from public.invoices where id = $1`, [inv4]), "void");
  assert.match((await errorOf(db, `update public.invoices set status = 'issued' where id = $1`, [inv4]))!, /can't be changed/);
  const r = await receipt("op-r4", 1000);
  assert.match((await errorOf(db, `select public.allocate_receipt($1, $2, 1000)`, [r, inv4]))!, /issued invoice/);
});

test("undoing an allocation puts the money back; re-paying doesn't grant credits twice", async () => {
  await asUser(db, biller);
  const r1 = await val<string>(db, `select id from public.receipts where operation_key = 'op-r1'`);
  const alloc = await val<string>(db, `select id from public.receipt_allocations where receipt_id = $1 and reversed_at is null`, [r1]);
  const before = (await credits(sam)).balance;
  await db.query(`select public.reverse_allocation($1, 'Wrong invoice')`, [alloc]);
  assert.equal((await position(inv1)).balance, 10000);
  assert.equal(await val(db, `select public.receipt_unapplied($1)`, [r1]), 10000);
  assert.equal((await credits(sam)).balance, before, "granted credits stay for a person to decide");
  const r2 = await val<string>(db, `select id from public.receipts where operation_key = 'op-r2'`);
  assert.match((await errorOf(db, `select public.reverse_receipt($1, 'x')`, [r2]))!, /Reverse its allocations first/);
  await db.query(`select public.allocate_receipt($1, $2, 10000)`, [r1, inv1]);
  assert.equal((await credits(sam)).balance, before);
});

test("sessions move credits: confirm reserves, reschedule keeps, cancel releases, held uses once", async () => {
  await asUser(db, biller);
  const c0 = await credits(sam);
  assert.ok(c0.available > 0);
  const s1 = await session("confirmed");
  assert.equal(await reservation(s1), "active");
  assert.equal((await credits(sam)).available, c0.available - 1);
  await db.query(`update public.coaching_sessions set scheduled_at = now() + interval '9 days' where id = $1`, [s1]);
  assert.equal(await reservation(s1), "active");
  await db.query(`update public.coaching_sessions set state = 'cancelled' where id = $1`, [s1]);
  assert.equal(await reservation(s1), "released");
  assert.deepEqual(await credits(sam), c0);

  const s2 = await session("proposed");
  assert.equal(await reservation(s2), undefined, "a proposal holds nothing");
  await db.query(`update public.coaching_sessions set state = 'confirmed' where id = $1`, [s2]);
  await db.query(`update public.coaching_sessions set state = 'held' where id = $1`, [s2]);
  assert.equal(await reservation(s2), "consumed");
  assert.equal((await credits(sam)).balance, c0.balance - 1);
  await db.query(`update public.coaching_sessions set state = 'confirmed' where id = $1`, [s2]);
  await db.query(`update public.coaching_sessions set state = 'held' where id = $1`, [s2]);
  assert.equal((await credits(sam)).balance, c0.balance - 1, "held twice still uses one credit");
});

test("no-shows wait for an explicit decision", async () => {
  await asUser(db, biller);
  const before = await credits(sam);
  const s = await session("confirmed");
  await db.query(`update public.coaching_sessions set state = 'no_show' where id = $1`, [s]);
  assert.equal(await reservation(s), "active");
  await asUser(db, sam);
  assert.match((await errorOf(db, `select public.resolve_no_show_credit($1, true, '')`, [s]))!, /billing admin/);
  await asUser(db, biller);
  await db.query(`select public.resolve_no_show_credit($1, true, 'Under 24 hours notice')`, [s]);
  assert.equal(await reservation(s), "consumed");
  assert.equal((await credits(sam)).balance, before.balance - 1);
  await db.query(`select public.resolve_no_show_credit($1, false, '')`, [s]);
  assert.equal(await reservation(s), "consumed", "a decision isn't silently reversed");
});

test("a session booked with no credit is uncovered, and is covered at held if paid by then", async () => {
  await asOwner(db);
  const pat = await makeUser(db, "pat@example.com");
  await asUser(db, biller);
  const s = await val<string>(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now(), 'confirmed', $2) returning id`, [pat, biller]);
  assert.equal(await reservation(s), undefined);
  await db.query(`select public.adjust_credits($1, 1, 'Complimentary first session', 'adj-pat')`, [pat]);
  await db.query(`select public.adjust_credits($1, 1, 'Complimentary first session', 'adj-pat')`, [pat]);
  assert.equal((await credits(pat)).balance, 1, "the same adjustment counts once");
  await db.query(`update public.coaching_sessions set state = 'held' where id = $1`, [s]);
  assert.equal(await reservation(s), "consumed");
  assert.deepEqual(await credits(pat), { balance: 0, reserved: 0, available: 0 });
  assert.match((await errorOf(db, `select public.adjust_credits($1, 1, '', 'adj-pat-2')`, [pat]))!, /reason/);
});

test("members see their own credits only; the webhook's server role can record card payments", async () => {
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.entitlement_ledger`), 0);
  assert.equal(await credits(sam), undefined);
  await asUser(db, sam);
  assert.ok((await val<number>(db, `select count(*)::int from public.entitlement_ledger`)) > 0);

  await asUser(db, biller);
  const inv = await draft(sam, [{ description: "Card test", quantity: 1, unit_pence: 4000 }]);
  await db.query(`select public.issue_invoice($1)`, [inv]);
  await asService(db);
  const r = await val<string>(db, `select public.record_receipt($1, 'payment_link', 'pi_test_1', 4000, 'GBP', '2026-10-15', 'card', null, 'stripe:pi_test_1')`, [sam]);
  assert.equal(await val(db, `select public.record_receipt($1, 'payment_link', 'pi_test_1', 4000, 'GBP', '2026-10-15', 'card', null, 'stripe:other')`, [sam]), r, "same provider payment, same record");
  assert.equal(await val(db, `select public.allocate_receipt($1, $2, 4000)`, [r, inv]), 0);
  await asOwner(db);
});

test("the tracker lists every invoice with its position, for billing admins only", async () => {
  await asUser(db, biller);
  const rows = (await db.query<{ number: string; status: string; balance_pence: number; notices: number }>(`select * from public.billing_invoice_list()`)).rows;
  assert.ok(rows.length >= 5);
  assert.equal(rows.find((r) => r.number === "AM-0001")?.notices, 1);
  await asUser(db, coach);
  assert.equal((await db.query(`select * from public.billing_invoice_list()`)).rows.length, 0);
  await asOwner(db);
});
