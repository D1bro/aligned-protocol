// "Your details" (migration 0016): members keep their own contact, location
// and billing details; coaches see contact details only; nobody can use it
// to change roles, coaches or anyone else's record. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let biller: string, coach: string, otherCoach: string, sam: string, robin: string;

before(async () => {
  db = await freshDb();
  biller = await makeUser(db, "biller@example.com", "admin");
  coach = await makeUser(db, "coach@example.com", "coach");
  otherCoach = await makeUser(db, "coach.b@example.com", "coach");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [biller]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
});

const details = `preferred_name = 'Sammy', phone = '+44 7700 900123', town = 'Chester', country = 'United Kingdom', timezone = 'Europe/London'`;

test("a member can save, read back and clear their own optional details", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `update public.profiles set ${details} where id = $1`, [sam]), null);
  assert.equal(await val(db, `select town from public.profiles where id = $1`, [sam]), "Chester");
  assert.equal(await errorOf(db, `update public.profiles set phone = null, town = null where id = $1`, [sam]), null);
  assert.equal(await val(db, `select coalesce(town, 'cleared') from public.profiles where id = $1`, [sam]), "cleared");
  await db.query(`update public.profiles set ${details} where id = $1`, [sam]);
});

test("the details form can't be used to change role, coach, billing access or sign-in email", async () => {
  await asUser(db, sam);
  for (const change of [`role = 'admin'`, `coach_id = null`, `can_manage_billing = true`, `email = 'new@example.com'`]) {
    assert.ok(await errorOf(db, `update public.profiles set ${change} where id = $1`, [sam]), change);
  }
  assert.ok(await errorOf(db, `update public.profiles set phone = repeat('9', 41) where id = $1`, [sam]), "length limits");
});

test("another member can't read or change someone's details", async () => {
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.profiles where id = $1`, [sam]), 0);
  await db.query(`update public.profiles set town = 'Elsewhere' where id = $1`, [sam]);
  await asOwner(db);
  assert.equal(await val(db, `select town from public.profiles where id = $1`, [sam]), "Chester", "unchanged");
});

test("the assigned coach sees contact details; another coach doesn't", async () => {
  await asUser(db, coach);
  assert.equal(await val(db, `select phone from public.profiles where id = $1`, [sam]), "+44 7700 900123");
  await asUser(db, otherCoach);
  assert.equal(await val(db, `select count(*)::int from public.profiles where id = $1`, [sam]), 0);
});

test("a member keeps their own billing name and address; a blank name falls back to their full name", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `select public.save_my_billing_details('S. Fictional', $1)`, ["1 Example Street\nChester\nCH1 1AA\nUnited Kingdom"]), null);
  assert.equal(await val(db, `select name from public.billing_customers where client_id = $1`, [sam]), "S. Fictional");
  await db.query(`select public.save_my_billing_details('', '')`);
  assert.equal(await val(db, `select name from public.billing_customers where client_id = $1`, [sam]), "Sam Fictional");
  assert.equal(await val(db, `select coalesce(address, 'cleared') from public.billing_customers where client_id = $1`, [sam]), "cleared");
  await db.query(`select public.save_my_billing_details('S. Fictional', 'Apartado 12, Lisboa, Portugal')`);
});

test("billing details: not the coach, only the member and billing staff; and a member can only touch their own", async () => {
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.billing_customers`), 0);
  await asUser(db, biller);
  assert.equal(await val(db, `select address from public.billing_customers where client_id = $1`, [sam]), "Apartado 12, Lisboa, Portugal");

  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.billing_customers`), 0, "can't read Sam's");
  assert.ok(await errorOf(db, `update public.billing_customers set address = 'x' where client_id = $1`, [sam]) === null);
  await asOwner(db);
  assert.equal(await val(db, `select address from public.billing_customers where client_id = $1`, [sam]), "Apartado 12, Lisboa, Portugal", "direct update did nothing");

  await asUser(db, robin);
  await db.query(`select public.save_my_billing_details('Robin', '')`);
  await asOwner(db);
  assert.equal(await val(db, `select count(*)::int from public.billing_customers where client_id = $1`, [robin]), 1, "only Robin's own record was created");
  assert.equal(await val(db, `select name from public.billing_customers where client_id = $1`, [sam]), "S. Fictional");
});

test("signed-out visitors can't use the billing function", async () => {
  await asOwner(db);
  await db.query(`set role anon`);
  assert.ok(await errorOf(db, `select public.save_my_billing_details('x', 'y')`));
  await db.query(`reset role`);
});
