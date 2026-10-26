// Session reminders (migration 0020): logged as a kind of client email, once
// per session time, and visible to the client's coach.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asOwner, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let coach: string, sam: string, other: string;

before(async () => {
  db = await freshDb();
  coach = await makeUser(db, "coach@example.com", "coach", "Cy Coach");
  other = await makeUser(db, "other@example.com", "coach", "Oz Other");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
});

test("the daily job can log a reminder, once per session time", async () => {
  await asOwner(db);
  const insert = `insert into public.message_jobs (client_id, kind, dedupe_key, to_email, subject, body_text) values ($1, 'session_reminder', $2, 'sam@example.com', 's', 'b') returning id`;
  assert.ok(await val(db, insert, [sam, "reminder:s1:2026-11-09T10:00:00+00:00"]));
  assert.match((await errorOf(db, insert, [sam, "reminder:s1:2026-11-09T10:00:00+00:00"])) ?? "", /duplicate|unique/);
  assert.ok(await val(db, insert, [sam, "reminder:s1:2026-11-10T10:00:00+00:00"]));
  assert.ok(await errorOf(db, `insert into public.message_jobs (client_id, kind, dedupe_key, to_email, subject, body_text) values ($1, 'made_up', 'x', 'e', 's', 'b')`, [sam]));
});

test("the client's coach sees the reminders; another coach doesn't", async () => {
  await asUser(db, coach);
  assert.equal(Number(await val(db, `select count(*) from public.message_jobs where kind = 'session_reminder'`)), 2);
  await asUser(db, other);
  assert.equal(Number(await val(db, `select count(*) from public.message_jobs where kind = 'session_reminder'`)), 0);
});
