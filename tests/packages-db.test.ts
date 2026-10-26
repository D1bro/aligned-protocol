// Packages (migration 0018): what clients can see and buy, the invoice a
// purchase issues, and credits that expire. Runs against an in-memory Postgres.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asOwner, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let admin: string, sam: string, robin: string, guest: string;
let block: string, newYear: string, priv: string, ended: string, retired: string;

const visibleTo = async (who: string) => {
  await asUser(db, who);
  return (await db.query<{ name: string }>(`select name from public.packages order by name`)).rows.map((r) => r.name);
};
const credits = async (client: string) =>
  (await db.query<{ balance: number; reserved: number; available: number }>(`select * from public.credit_position($1)`, [client])).rows[0];
const pay = async (client: string, invoice: string, amount: number, key: string) => {
  await asUser(db, admin);
  const r = await val<string>(db, `select public.record_receipt($1, 'bank_transfer', null, $2, 'GBP', '2026-10-26', 'ref', null, $3)`, [client, amount, key]);
  await db.query(`select public.allocate_receipt($1, $2, $3)`, [r, invoice, amount]);
};

before(async () => {
  db = await freshDb();
  admin = await makeUser(db, "admin@example.com", "admin", "Ada Admin");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  guest = await makeUser(db, "guest@example.com", "client", "Guest");
  await asOwner(db);
  await db.query(`update auth.users set is_anonymous = true where id = $1`, [guest]);
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [admin]);
  await db.query(`update public.billing_settings set legal_name = 'Fictional Trader', address = '1 Example St', contact_email = 'b@example.com',
                  bank_account_name = 'Fictional', bank_sort_code = '00-00-00', bank_account_number = '00000000' where id = 1`);
});

test("only a billing admin can create packages", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `insert into public.packages (name, price_pence, sessions) values ('Free', 100, 1)`));
  await asUser(db, admin);
  block = await val(db, `insert into public.packages (name, price_pence, sessions, valid_days) values ('Block of 4', 30000, 4, 90) returning id`);
  newYear = await val(db, `insert into public.packages (name, price_pence, sessions, valid_days, available_from, available_until)
                           values ('New Year deal', 100000, 12, 84, current_date - 1, current_date + 30) returning id`);
  priv = await val(db, `insert into public.packages (name, price_pence, sessions, audience) values ('Private rate', 20000, 4, 'selected') returning id`);
  ended = await val(db, `insert into public.packages (name, price_pence, sessions, available_until) values ('Old deal', 10000, 2, current_date - 1) returning id`);
  retired = await val(db, `insert into public.packages (name, price_pence, sessions, active) values ('Retired', 10000, 2, false) returning id`);
  await db.query(`insert into public.package_audience (package_id, client_id) values ($1, $2)`, [priv, sam]);
});

test("clients see only what's on offer to them", async () => {
  assert.deepEqual(await visibleTo(sam), ["Block of 4", "New Year deal", "Private rate"]);
  assert.deepEqual(await visibleTo(robin), ["Block of 4", "New Year deal"]);
});

test("buying issues a normal invoice in the client's name, and doesn't duplicate an unpaid one", async () => {
  await asUser(db, sam);
  const inv = await val<string>(db, `select public.buy_package($1)`, [block]);
  const row = (await db.query<Record<string, any>>(`select status, number, total_pence, credits_purchased, credits_valid_days, package_id, customer from public.invoices where id = $1`, [inv])).rows[0];
  assert.equal(row.status, "issued");
  assert.match(row.number, /^AM-\d{4}$/);
  assert.equal(row.total_pence, 30000);
  assert.equal(row.credits_purchased, 4);
  assert.equal(row.credits_valid_days, 90);
  assert.equal(row.customer.name, "Sam Fictional");
  assert.equal(await val(db, `select public.buy_package($1)`, [block]), inv, "an unpaid one is reused");
  assert.match((await val<string>(db, `select description from public.invoice_items where invoice_id = $1`, [inv])), /Block of 4 \(4 sessions, to use within 90 days\)/);
});

test("packages not on offer can't be bought; guests can't buy", async () => {
  await asUser(db, robin);
  assert.match((await errorOf(db, `select public.buy_package($1)`, [priv]))!, /isn't available/);
  assert.match((await errorOf(db, `select public.buy_package($1)`, [ended]))!, /isn't available/);
  assert.match((await errorOf(db, `select public.buy_package($1)`, [retired]))!, /isn't available/);
  await asUser(db, guest);
  assert.match((await errorOf(db, `select public.buy_package($1)`, [block]))!, /Create your account/);
  await asUser(db, robin);
  assert.match((await errorOf(db, `select public.issue_invoice(gen_random_uuid())`))!, /billing admin/, "clients still can't issue invoices");
});

test("paying in full grants the credits, with an expiry date", async () => {
  await asUser(db, sam);
  const inv = await val<string>(db, `select public.buy_package($1)`, [block]);
  await pay(sam, inv, 30000, "sam-block");
  await asUser(db, sam);
  assert.deepEqual(await credits(sam), { balance: 4, reserved: 0, available: 4 });
  const days = await val<number>(db, `select round(extract(epoch from (expires_at - now())) / 86400) from public.entitlement_ledger where invoice_id = $1`, [inv]);
  assert.equal(Number(days), 90);
  const exp = (await db.query(`select * from public.credit_expiries($1)`, [sam])).rows;
  assert.equal(exp.length, 1);
});

test("sessions use the soonest-expiring credits first, and expired credits stop counting", async () => {
  await asOwner(db);
  // Robin: 2 credits that expire soon (granted first) and 2 that never expire.
  await db.query(`insert into public.entitlement_ledger (client_id, kind, quantity, reason, operation_key, created_at, expires_at)
                  values ($1, 'grant', 2, 'soon', 'r1', now() - interval '20 days', now() + interval '5 days'),
                         ($1, 'grant', 2, 'forever', 'r2', now() - interval '10 days', null),
                         ($1, 'use', -1, 'held', 'r3', now() - interval '2 days', null)`, [robin]);
  await asUser(db, robin);
  assert.equal((await credits(robin)).available, 3);
  // Time passes: the 'soon' grant expires with 1 left unused.
  await asOwner(db);
  await db.query(`update public.entitlement_ledger set expires_at = now() - interval '1 hour' where operation_key = 'r1'`);
  await asUser(db, robin);
  assert.equal((await credits(robin)).available, 2, "the use came from the expiring credits; the lasting ones are intact");
});

test("a use after credits expired comes from what was still valid", async () => {
  await asOwner(db);
  const c = await makeUser(db, "casey@example.com", "client", "Casey");
  await asOwner(db);
  await db.query(`insert into public.entitlement_ledger (client_id, kind, quantity, reason, operation_key, created_at, expires_at)
                  values ($1, 'grant', 4, 'old', 'c1', now() - interval '100 days', now() - interval '10 days'),
                         ($1, 'grant', 4, 'new', 'c2', now() - interval '5 days', now() + interval '80 days'),
                         ($1, 'use', -1, 'held', 'c3', now() - interval '1 day', null)`, [c]);
  await asUser(db, c);
  assert.equal((await credits(c)).available, 3);
});

test("an issued invoice's package details are frozen; drafts from a package are admin-only", async () => {
  await asUser(db, admin);
  const inv = await val<string>(db, `select id from public.invoices where package_id = $1 limit 1`, [block]);
  assert.match((await errorOf(db, `update public.invoices set credits_valid_days = 365 where id = $1`, [inv]))!, /can't be changed/);
  const d = await val<string>(db, `select public.draft_invoice_from_package($1, $2)`, [robin, newYear]);
  assert.equal(await val(db, `select status from public.invoices where id = $1`, [d]), "draft");
  assert.equal(await val(db, `select credits_purchased from public.invoices where id = $1`, [d]), 12);
  await asUser(db, robin);
  assert.match((await errorOf(db, `select public.draft_invoice_from_package($1, $2)`, [robin, newYear]))!, /billing admin/);
  await asUser(db, admin);
  assert.ok(await errorOf(db, `delete from public.packages where id = $1`, [block]), "a sold package can't be deleted");
});
