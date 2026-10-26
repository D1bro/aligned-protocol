// Team and access (migration 0019): roles and billing access, changed only
// through the checked functions. Runs against an in-memory Postgres.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asOwner, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let owner: string, other: string, coach: string, sam: string;

const access = async (id: string) => {
  await asOwner(db);
  return (await db.query<{ role: string; can_manage_billing: boolean }>(`select role, can_manage_billing from public.profiles where id = $1`, [id])).rows[0];
};

before(async () => {
  db = await freshDb();
  owner = await makeUser(db, "owner@example.com", "admin", "Ada Owner");
  other = await makeUser(db, "other@example.com", "admin", "Bo Admin");
  coach = await makeUser(db, "coach@example.com", "coach", "Cy Coach");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  await asOwner(db);
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [owner]);
});

test("a member or a non-billing admin can't grant billing", async () => {
  await asUser(db, sam);
  assert.match((await errorOf(db, `select public.admin_set_billing($1, true)`, [sam])) ?? "", /billing admin/);
  await asUser(db, other);
  assert.match((await errorOf(db, `select public.admin_set_billing($1, true)`, [other])) ?? "", /billing admin/);
  assert.equal((await access(other)).can_manage_billing, false);
});

test("a billing admin can grant billing to another admin, not to a coach", async () => {
  await asUser(db, owner);
  assert.match((await errorOf(db, `select public.admin_set_billing($1, true)`, [coach])) ?? "", /admin first/);
  await db.query(`select public.admin_set_billing($1, true)`, [other]);
  assert.equal((await access(other)).can_manage_billing, true);
  await asUser(db, other);
  assert.equal(await val(db, `select public.can_bill()`), true);
});

test("nobody can remove their own billing access", async () => {
  await asUser(db, owner);
  assert.match((await errorOf(db, `select public.admin_set_billing($1, false)`, [owner])) ?? "", /your own/);
  assert.equal((await access(owner)).can_manage_billing, true);
});

test("moving a billing admin off admin removes billing, so it doesn't return with admin", async () => {
  await asUser(db, owner);
  await db.query(`select public.admin_set_role($1, 'coach')`, [other]);
  assert.deepEqual(await access(other), { role: "coach", can_manage_billing: false });
  await asUser(db, owner);
  await db.query(`select public.admin_set_role($1, 'admin')`, [other]);
  assert.deepEqual(await access(other), { role: "admin", can_manage_billing: false });
});

test("a non-billing admin can't demote a billing admin, but can manage coaches", async () => {
  await asUser(db, other);
  assert.match((await errorOf(db, `select public.admin_set_role($1, 'coach')`, [owner])) ?? "", /billing admin/);
  assert.equal((await access(owner)).role, "admin");
  await asUser(db, other);
  await db.query(`select public.admin_set_role($1, 'admin')`, [coach]);
  assert.equal((await access(coach)).role, "admin");
});

test("no one can remove their own admin access; billing can be removed from others", async () => {
  await asUser(db, owner);
  assert.match((await errorOf(db, `select public.admin_set_role($1, 'coach')`, [owner])) ?? "", /your own admin/);
  await db.query(`select public.admin_set_billing($1, true)`, [coach]);
  await db.query(`select public.admin_set_billing($1, false)`, [coach]);
  assert.equal((await access(coach)).can_manage_billing, false);
});

test("billing access can't be changed by editing the profile directly", async () => {
  await asUser(db, other);
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [other]).catch(() => null);
  assert.equal((await access(other)).can_manage_billing, false);
});
