// Who can see and create email records (migration 0015).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let biller: string, coach: string, sam: string, robin: string;
const insert = (client: string, kind: string, key: string) =>
  errorOf(db, `insert into public.message_jobs (client_id, kind, dedupe_key, to_email, subject, body_text) values ($1, $2, $3, 'x@example.com', 's', 'b')`, [client, kind, key]);

before(async () => {
  db = await freshDb();
  biller = await makeUser(db, "biller@example.com", "admin");
  coach = await makeUser(db, "coach@example.com", "coach");
  sam = await makeUser(db, "sam@example.com");
  robin = await makeUser(db, "robin@example.com");
  await db.query(`update public.profiles set can_manage_billing = true where id = $1`, [biller]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
});

test("a coach can record coaching emails for their own client only", async () => {
  await asUser(db, coach);
  assert.equal(await insert(sam, "summary_shared", "summary:1"), null);
  assert.ok(await insert(robin, "summary_shared", "summary:2"), "not their client");
});

test("billing emails are for billing admins only", async () => {
  await asUser(db, coach);
  assert.ok(await insert(sam, "invoice_issued", "invoice:1"));
  await asUser(db, biller);
  assert.equal(await insert(sam, "invoice_issued", "invoice:1"), null);
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.message_jobs where kind = 'invoice_issued'`), 0, "the coach can't see it");
});

test("the same email can't be recorded twice", async () => {
  await asUser(db, coach);
  assert.match((await insert(sam, "summary_shared", "summary:1"))!, /duplicate key/);
});

test("members can't see or create email records", async () => {
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.message_jobs`), 0);
  assert.ok(await insert(sam, "summary_shared", "summary:3"));
});
