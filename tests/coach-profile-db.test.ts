// Coach profile and client context (migration 0026): each coach's own,
// private even from admins and never visible to clients. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let casey: string, alex: string, admin: string, sam: string, robin: string;

before(async () => {
  db = await freshDb();
  casey = await makeUser(db, "casey@example.com", "coach", "Casey Coach");
  alex = await makeUser(db, "alex@example.com", "coach", "Alex Coach");
  admin = await makeUser(db, "admin@example.com", "admin", "Ada Admin");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [casey, sam]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [alex, robin]);
});

test("a coach keeps their own profile; nobody else reads it", async () => {
  await asUser(db, casey);
  assert.equal(
    await errorOf(db, `insert into public.coach_profiles (coach_id, approach, working_on) values ($1, 'Warm, direct when it helps.', $2)`, [casey, JSON.stringify([{ id: "a", text: "Let them finish", added: "2026-11-09" }])]),
    null
  );
  for (const who of [alex, admin, sam]) {
    await asUser(db, who);
    assert.equal(await val(db, `select count(*)::int from public.coach_profiles`), 0);
  }
  await asUser(db, sam);
  assert.ok(await errorOf(db, `insert into public.coach_profiles (coach_id, approach) values ($1, 'I am a client')`, [sam]), "clients can't have one");
});

test("client context is for the coach's own clients, and private to that coach", async () => {
  await asUser(db, casey);
  assert.equal(await errorOf(db, `insert into public.client_contexts (coach_id, client_id, notes) values ($1, $2, 'Early on Sam did not feel safe.')`, [casey, sam]), null);
  assert.ok(await errorOf(db, `insert into public.client_contexts (coach_id, client_id, notes) values ($1, $2, 'Not mine')`, [casey, robin]), "not someone else's client");
  for (const who of [alex, admin, sam]) {
    await asUser(db, who);
    assert.equal(await val(db, `select count(*)::int from public.client_contexts`), 0);
  }
});
