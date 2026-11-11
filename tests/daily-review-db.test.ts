// The weekly review and sharing (migration 0035): a review is the member's
// alone, one a week, on their own Next Step; sharing copies one entry, review
// or question for their coach, never the journal itself, and can be taken
// back. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, otherCoach: string, samGoal: string, robinGoal: string, entry: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  otherCoach = await makeUser(db, "other@example.com", "coach", "Olly Other");
  await db.query(`update public.profiles set coach_id = $2 where id = $1`, [sam, coach]);
  await asUser(db, sam);
  samGoal = await val<string>(db, `insert into public.goals (client_id, goal_title, status) values ($1, 'Train three times a week', 'active') returning id`, [sam]);
  entry = await val<string>(db, `insert into public.journal_entries (client_id, entry_date, body) values ($1, '2026-11-11', 'A private thought') returning id`, [sam]);
  await asUser(db, robin);
  robinGoal = await val<string>(db, `insert into public.goals (client_id, goal_title, status) values ($1, 'Robin''s step', 'active') returning id`, [robin]);
});

test("one review a week, starting on a Monday, on their own Next Step", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.daily_reviews (client_id, week_start, goal_id, moved, closer, decision) values ($1, '2026-11-09', $2, 'Three visits', 'closer', 'keep')`, [sam, samGoal]), null);
  assert.ok(await errorOf(db, `insert into public.daily_reviews (client_id, week_start) values ($1, '2026-11-09')`, [sam]), "one a week");
  assert.ok(await errorOf(db, `insert into public.daily_reviews (client_id, week_start) values ($1, '2026-11-10')`, [sam]), "weeks start Monday");
  assert.ok(await errorOf(db, `insert into public.daily_reviews (client_id, week_start, goal_id) values ($1, '2026-11-02', $2)`, [sam, robinGoal]), "not someone else's Next Step");
  assert.ok(await errorOf(db, `insert into public.daily_reviews (client_id, week_start, closer) values ($1, '2026-10-26', 'nearly')`, [sam]));
});

test("a review is private: not the coach's, not anyone else's", async () => {
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.daily_reviews`), 0);
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.daily_reviews`), 0);
  assert.ok(await errorOf(db, `insert into public.daily_reviews (client_id, week_start) values ($1, '2026-11-09')`, [sam]), "not on someone else's behalf");
});

test("sharing copies one thing for their own coach, never the journal, and can be taken back", async () => {
  await asUser(db, sam);
  await db.query(`insert into public.prep_shares (client_id, kind, source_id, title, content) values ($1, 'entry', $2, 'A journal entry', 'A private thought')`, [sam, entry]);
  await db.query(`insert into public.prep_shares (client_id, kind, title, content) values ($1, 'question', 'A question for coaching', 'How do I keep going when work is busy?')`, [sam]);
  assert.ok(await errorOf(db, `insert into public.prep_shares (client_id, kind, source_id, content) values ($1, 'entry', $2, 'again')`, [sam, entry]), "the same entry once");
  assert.ok(await errorOf(db, `insert into public.prep_shares (client_id, kind, content) values ($1, 'everything', 'x')`, [sam]));

  await asUser(db, coach);
  assert.deepEqual((await db.query<{ kind: string }>(`select kind from public.prep_shares order by kind`)).rows.map((r) => r.kind), ["entry", "question"]);
  assert.equal(await val(db, `select count(*)::int from public.journal_entries`), 0, "the journal itself stays private");
  await asUser(db, otherCoach);
  assert.equal(await val(db, `select count(*)::int from public.prep_shares`), 0, "only their own coach");

  await asUser(db, sam);
  await db.query(`delete from public.prep_shares where client_id = $1 and kind = 'entry'`, [sam]);
  await asUser(db, coach);
  assert.deepEqual((await db.query<{ kind: string }>(`select kind from public.prep_shares`)).rows.map((r) => r.kind), ["question"]);
});

test("session preparation shared before 0035 reads as preparation", async () => {
  await asUser(db, sam);
  assert.equal(await val(db, `insert into public.prep_shares (client_id, content) values ($1, 'Notes for Thursday') returning kind`, [sam]), "prep");
});
