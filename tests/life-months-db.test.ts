// 1,000 Months (migration 0024): the optional date of birth and month
// reflections are the member's alone; their coach can't read them. A colour
// is one of the six the member chooses from. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
});

test("a member keeps an optional date of birth, privately", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.life_details (client_id, birth_date) values ($1, '1988-04-17')`, [sam]), null);
  assert.ok(await errorOf(db, `update public.life_details set birth_date = '1850-01-01' where client_id = $1`, [sam]));
  assert.ok(await errorOf(db, `insert into public.life_details (client_id, birth_date) values ($1, '1990-01-01')`, [robin]), "not for someone else");
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.life_details`), 0, "their coach can't read it");
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.life_details`), 0);
});

test("one reflection a month: a colour they choose and/or a few words", async () => {
  await asUser(db, sam);
  const add = (month: string, colour: string | null, words: string | null) =>
    errorOf(db, `insert into public.month_reflections (client_id, month, colour, reflection) values ($1, $2, $3, $4)`, [sam, month, colour, words]);
  assert.equal(await add("2026-10-01", "restoring", "A quieter month, and I needed it."), null);
  assert.equal(await add("2026-09-01", null, "Hard, but I kept going."), null);
  assert.ok(await add("2026-10-01", "aligned", null), "only one per month");
  assert.ok(await add("2026-08-01", "failing", null), "only the six colours");
  assert.ok(await add("2026-07-01", null, "  "), "something to keep");
  assert.ok(await add("2026-05-01", null, null), "not empty");
  assert.ok(await add("2026-06-15", "growing", null), "month is the first day");
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.month_reflections`), 0, "their coach can't read them");
});
