// Follow-up emails after the audit (migration 0037): off unless asked for at
// sign-up, the member can turn them off but nobody else's, and each one is
// logged once in message_jobs.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asOwner, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
});

test("new accounts are off unless the sign-up box was ticked", async () => {
  await asOwner(db);
  assert.equal(await val(db, `select followups_email from public.profiles where id = $1`, [sam]), false);
  const asked = await val<string>(db, `insert into auth.users (email, raw_user_meta_data) values ('asked@example.com', '{"full_name":"Asked","followups_email":"true"}') returning id`);
  const row = (await db.query<{ followups_email: boolean; followups_at: string | null; reminders_email: boolean }>(`select followups_email, followups_at, reminders_email from public.profiles where id = $1`, [asked])).rows[0];
  assert.equal(row.followups_email, true);
  assert.ok(row.followups_at);
  assert.equal(row.reminders_email, false); // the two choices are separate
});

test("a member can change their own choice, not someone else's", async () => {
  await asUser(db, sam);
  await db.query(`update public.profiles set followups_email = true, followups_at = now() where id = $1`, [sam]);
  await db.query(`update public.profiles set followups_email = true where id = $1`, [robin]);
  await asOwner(db);
  assert.equal(await val(db, `select followups_email from public.profiles where id = $1`, [sam]), true);
  assert.equal(await val(db, `select followups_email from public.profiles where id = $1`, [robin]), false);
});

test("each follow-up is logged once", async () => {
  await asOwner(db);
  const insert = `insert into public.message_jobs (client_id, kind, dedupe_key, to_email, subject, body_text) values ($1, 'followup', $2, 'sam@example.com', 's', 'b') returning id`;
  assert.ok(await val(db, insert, [sam, `followup:${sam}:1`]));
  assert.match((await errorOf(db, insert, [sam, `followup:${sam}:1`])) ?? "", /duplicate|unique/);
  assert.ok(await val(db, insert, [sam, `followup:${sam}:3`]));
});
