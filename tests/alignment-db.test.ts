// Fictional users, isolated in-memory Postgres. Never contacts Supabase.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshDb, asUser, asOwner, asService, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, admin: string, guest: string;
let samGoal: string, robinGoal: string;
before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam.alignment@example.com");
  robin = await makeUser(db, "robin.alignment@example.com");
  coach = await makeUser(db, "coach.alignment@example.com", "coach");
  admin = await makeUser(db, "admin.alignment@example.com", "admin");
  guest = await makeUser(db, "guest.alignment@example.com");
  await db.query(`update auth.users set is_anonymous = true where id = $1`, [guest]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
  samGoal = await val(db, `insert into public.goals (client_id, goal_title) values ($1, 'Fictional personal goal') returning id`, [sam]);
  robinGoal = await val(db, `insert into public.goals (client_id, goal_title) values ($1, 'Fictional other goal') returning id`, [robin]);
});

test("one optional private record per local date and Monday week supports upsert", async () => {
  await asUser(db, sam);
  await db.query(`insert into public.daily_alignments (client_id, entry_date, timezone, goal_id, priority, values_choice)
    values ($1, '2026-10-19', 'Europe/London', $2, 'Take one meaningful step', 'not_needed')`, [sam, samGoal]);
  assert.equal(await val(db, `select wellbeing from public.daily_alignments where client_id=$1`, [sam]), null);
  await db.query(`insert into public.daily_alignments (client_id, entry_date, timezone, priority)
    values ($1, '2026-10-19', 'Europe/London', 'Choose a smaller step')
    on conflict (client_id, entry_date) do update set priority=excluded.priority`, [sam]);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 1);
  assert.equal(await val(db, `select priority from public.daily_alignments`), "Choose a smaller step");
  await db.query(`insert into public.alignment_weekly_reviews (client_id, week_start, timezone, helped)
    values ($1, '2026-10-19', 'Europe/London', 'Going outside')
    on conflict (client_id, week_start) do update set helped=excluded.helped`, [sam]);
  await db.query(`insert into public.alignment_weekly_reviews (client_id, week_start, timezone, helped)
    values ($1, '2026-10-19', 'Europe/London', 'Making space')
    on conflict (client_id, week_start) do update set helped=excluded.helped`, [sam]);
  assert.equal(await val(db, `select helped from public.alignment_weekly_reviews`), "Making space");
  assert.ok(await errorOf(db, `insert into public.alignment_weekly_reviews (client_id, week_start) values ($1, '2026-10-20')`, [sam]));
  assert.equal(await val(db, `select count(*)::int from public.alignment_weekly_reviews`), 1);
});

test("an unanswered score stays null and an explicit false presence stays false after edits", async () => {
  await asUser(db, sam);
  const before = await db.query<{ presence_done: boolean | null; wellbeing: string | null }>(`select presence_done,wellbeing from public.daily_alignments`);
  assert.deepEqual(before.rows, [{ presence_done: null, wellbeing: null }]);
  await db.query(`update public.daily_alignments set presence_done=false, wellbeing='partly' where client_id=$1`, [sam]);
  const after = await db.query<{ presence_done: boolean | null; wellbeing: string | null }>(`select presence_done,wellbeing from public.daily_alignments`);
  assert.deepEqual(after.rows, [{ presence_done: false, wellbeing: "partly" }]);
  await db.query(`update public.daily_alignments set wellbeing=null where client_id=$1`, [sam]);
  assert.equal(await val(db, `select wellbeing from public.daily_alignments`), null);
});

test("a second member, assigned coach and administrator cannot read or change private records", async () => {
  for (const user of [robin, coach, admin]) {
    await asUser(db, user);
    assert.equal(await val(db, `select count(*)::int from public.daily_alignments where client_id=$1`, [sam]), 0);
    assert.equal(await val(db, `select count(*)::int from public.alignment_weekly_reviews where client_id=$1`, [sam]), 0);
    await db.query(`update public.daily_alignments set priority='Changed' where client_id=$1`, [sam]);
    await db.query(`delete from public.alignment_weekly_reviews where client_id=$1`, [sam]);
    assert.ok(await errorOf(db, `insert into public.daily_alignments (client_id,entry_date) values ($1,'2026-10-20')`, [sam]));
  }
  await asOwner(db);
  assert.equal(await val(db, `select priority from public.daily_alignments where client_id=$1`, [sam]), "Choose a smaller step");
  assert.equal(await val(db, `select count(*)::int from public.alignment_weekly_reviews where client_id=$1`, [sam]), 1);
});

test("anonymous guests and signed-out visitors cannot save, read, delete or export private records", async () => {
  await asUser(db, guest);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 0);
  assert.equal(await val(db, `select count(*)::int from public.alignment_weekly_reviews`), 0);
  assert.ok(await errorOf(db, `insert into public.daily_alignments(client_id, entry_date) values ($1,'2026-10-19')`, [guest]));
  assert.ok(await errorOf(db, `insert into public.alignment_weekly_reviews(client_id, week_start) values ($1,'2026-10-19')`, [guest]));
  await db.query(`delete from public.daily_alignments where client_id=$1`, [sam]);
  await asOwner(db);
  await db.exec(`set role anon`);
  assert.ok(await errorOf(db, `select * from public.daily_alignments`));
  assert.ok(await errorOf(db, `select * from public.alignment_weekly_reviews`));
  assert.ok(await errorOf(db, `insert into public.daily_alignments(client_id,entry_date) values ($1,'2026-10-19')`, [guest]));
});

test("goal ownership and immutable record ownership hold even when a coach can see the goal", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `update public.daily_alignments set goal_id=$1 where client_id=$2`, [robinGoal, sam]));
  assert.ok(await errorOf(db, `update public.daily_alignments set client_id=$1 where client_id=$2`, [robin, sam]));
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.goals where id=$1`, [samGoal]), 1);
  assert.ok(await errorOf(db, `insert into public.daily_alignments (client_id,entry_date,goal_id) values ($1,'2026-10-19',$2)`, [coach, samGoal]));
  await asUser(db, sam);
  assert.equal(await val(db, `select goal_id from public.daily_alignments`), samGoal);
});

test("service role is not granted application access to private alignment tables", async () => {
  await asService(db);
  assert.ok(await errorOf(db, `select * from public.daily_alignments`));
  assert.ok(await errorOf(db, `select * from public.alignment_weekly_reviews`));
  assert.ok(await errorOf(db, `insert into public.daily_alignments(client_id,entry_date) values ($1,'2026-10-19')`, [sam]));
});

test("database rejects invalid enums, overlong notes and timezone bypasses", async () => {
  await asUser(db, sam);
  for (const change of ["wellbeing='not_needed'", "participation='5'", "values_choice='failure'", "priority=repeat('a',501)", "value=repeat('a',81)", "wellbeing_action=repeat('a',301)", "evening_note=repeat('a',1001)", "timezone='Invalid/Place'"]) {
    assert.ok(await errorOf(db, `update public.daily_alignments set ${change} where client_id=$1`, [sam]), change);
  }
  assert.ok(await errorOf(db, `update public.alignment_weekly_reviews set helped=repeat('a',1001) where client_id=$1`, [sam]));
});

test("deleting an owned linked goal keeps the private entry and clears the link", async () => {
  await asUser(db, sam);
  await db.query(`delete from public.goals where id=$1`, [samGoal]);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 1);
  assert.equal(await val(db, `select goal_id from public.daily_alignments`), null);
});

test("export query contains only the member's entries, and their delete clears them", async () => {
  await asUser(db, robin);
  await db.query(`insert into public.daily_alignments(client_id,entry_date) values ($1,'2026-10-19')`, [robin]);
  await asUser(db, sam);
  assert.deepEqual((await db.query<{ client_id: string }>(`select client_id from public.daily_alignments order by entry_date`)).rows.map((r) => r.client_id), [sam]);
  await db.query(`delete from public.daily_alignments where client_id=$1 and entry_date='2026-10-19'`, [sam]);
  await db.query(`delete from public.alignment_weekly_reviews where client_id=$1 and week_start='2026-10-19'`, [sam]);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 0);
  assert.equal(await val(db, `select count(*)::int from public.alignment_weekly_reviews`), 0);
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 1);
});

test("alignment migration can be rerun without deleting saved data or broadening RLS", async () => {
  await asOwner(db);
  await db.exec(readFileSync(new URL("../supabase/migrations/0017_daily_alignment.sql", import.meta.url), "utf8"));
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments where client_id=$1`, [robin]), 1);
  await asUser(db, admin);
  assert.equal(await val(db, `select count(*)::int from public.daily_alignments`), 0);
});
