// Memberships (migration 0022): members read only their own; only the server
// writes them; a paid Focus package unlocks Momentum for its weeks; the
// Momentum session details are for Momentum members; the journal is private.
// Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let admin: string, sam: string, robin: string, alex: string;

before(async () => {
  db = await freshDb();
  admin = await makeUser(db, "admin@example.com", "admin");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  alex = await makeUser(db, "alex@example.com", "client", "Alex Example");
  // The server writes memberships (Supabase's service role skips row rules;
  // here the table owner stands in for it).
  await asOwner(db);
  await db.query(
    `insert into public.memberships (client_id, tier, status, stripe_subscription_id, stripe_customer_id, price_pence, current_period_end)
     values ($1, 'practice', 'active', 'sub_test_sam', 'cus_test_sam', 900, now() + interval '20 days'),
            ($2, 'momentum', 'canceled', 'sub_test_robin', 'cus_test_robin', 2500, now() - interval '2 days')`,
    [sam, robin]
  );
});

const tiers = async (who: string) => {
  await asUser(db, who);
  return (await db.query<{ tier: string }>(`select tier from public.my_membership()`)).rows.map((r) => r.tier);
};

test("an active subscription counts; a cancelled one doesn't", async () => {
  assert.deepEqual(await tiers(sam), ["practice"]);
  assert.deepEqual(await tiers(robin), []);
});

test("members read only their own membership and can't write one", async () => {
  await asUser(db, sam);
  assert.equal(Number(await val(db, `select count(*) from public.memberships`)), 1);
  await db.query(`update public.memberships set tier = 'momentum' where client_id = $1`, [sam]);
  assert.equal(await val(db, `select tier from public.memberships where client_id = $1`, [sam]), "practice");
  assert.ok(
    await errorOf(
      db,
      `insert into public.memberships (client_id, tier, status, stripe_subscription_id, stripe_customer_id, price_pence) values ($1, 'momentum', 'active', 'sub_fake', 'cus_fake', 1)`,
      [sam]
    )
  );
  await asUser(db, admin);
  assert.equal(Number(await val(db, `select count(*) from public.memberships`)), 2);
});

test("a paid Focus package unlocks Momentum for its weeks", async () => {
  await asOwner(db);
  const pkg = await val<string>(db, `insert into public.packages (name, price_pence, sessions, valid_days, includes_membership) values ('Aligned Focus', 99500, 3, 42, 'momentum') returning id`);
  const inv = await val<string>(db, `insert into public.invoices (client_id, package_id) values ($1, $2) returning id`, [alex, pkg]);
  await db.query(`insert into public.entitlement_ledger (client_id, kind, quantity, invoice_id, operation_key) values ($1, 'grant', 3, $2, 'test-focus')`, [alex, inv]);
  assert.deepEqual(await tiers(alex), ["momentum"]);
  // Six weeks on, it has run out.
  await asOwner(db);
  await db.query(`update public.entitlement_ledger set created_at = now() - interval '43 days' where operation_key = 'test-focus'`);
  assert.deepEqual(await tiers(alex), []);
});

test("Momentum session details are for Momentum members and admins", async () => {
  await asUser(db, admin);
  assert.equal(await errorOf(db, `update public.membership_settings set momentum_when = 'Tuesdays at 7pm', momentum_join_url = 'https://zoom.example.com/j/1'`), null);
  assert.ok(await errorOf(db, `update public.membership_settings set momentum_join_url = 'http://insecure.example.com'`));
  await asUser(db, sam);
  assert.equal(Number(await val(db, `select count(*) from public.membership_settings`)), 0);
  await asOwner(db);
  await db.query(`update public.memberships set tier = 'momentum' where client_id = $1`, [sam]);
  await asUser(db, sam);
  assert.equal(await val(db, `select momentum_when from public.membership_settings`), "Tuesdays at 7pm");
});

test("the journal is private to its writer, admins included", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.journal_entries (client_id, entry_date, body) values ($1, '2026-10-27', 'A quiet start to the week.')`, [sam]), null);
  assert.ok(await errorOf(db, `insert into public.journal_entries (client_id, entry_date, body) values ($1, '2026-10-27', '   ')`, [sam]));
  assert.ok(await errorOf(db, `insert into public.journal_entries (client_id, entry_date, body) values ($1, '2026-10-27', 'Not mine')`, [robin]));
  await asUser(db, robin);
  assert.equal(Number(await val(db, `select count(*) from public.journal_entries`)), 0);
  await asUser(db, admin);
  assert.equal(Number(await val(db, `select count(*) from public.journal_entries`)), 0);
});
