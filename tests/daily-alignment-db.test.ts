// The Daily Alignment (migration 0034): actions and their logs are the
// member's own; private by default (a coach sees one only once it's shared);
// one tick a day; the timer logs the actual time, once; check-ins and timers
// are the member's alone. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, gym: string, meditation: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  await db.query(`update public.profiles set coach_id = $2 where id = $1`, [sam, coach]);
  await asUser(db, sam);
  const area = await val<string>(db, `select id from public.life_areas order by sort_order limit 1`);
  gym = await val<string>(db, `insert into public.daily_actions (client_id, name, measure, target, period, unit, life_area_id, days, at_time, private) values ($1, 'Gym', 'count', 4, 'week', 'visits', $2, '{0,2,4}', '07:30', false) returning id`, [sam, area]);
  meditation = await val<string>(db, `insert into public.daily_actions (client_id, name, measure, target, period, mindful) values ($1, 'Meditation', 'minutes', 10, 'day', true) returning id`, [sam]);
  await val<string>(db, `insert into public.daily_actions (client_id, name, measure, run_started) values ($1, 'Retention', 'run', '2026-11-01') returning id`, [sam]);
});

test("actions are private by default, and the time is kept exactly", async () => {
  await asUser(db, sam);
  assert.equal(await val(db, `select private from public.daily_actions where id = $1`, [meditation]), true);
  assert.equal(await val(db, `select at_time::text from public.daily_actions where id = $1`, [gym]), "07:30:00");
  assert.ok(await errorOf(db, `insert into public.daily_actions (client_id, name, measure) values ($1, 'x', 'streak')`, [sam]), "only the four measures");
  assert.ok(await errorOf(db, `insert into public.daily_actions (client_id, name, measure, days) values ($1, 'x', 'done', '{7}')`, [sam]), "weekdays 0–6");
});

test("one tick a day, and a count is one row a day", async () => {
  await asUser(db, sam);
  const done = await val<string>(db, `insert into public.daily_actions (client_id, name, measure) values ($1, 'Yoga', 'done') returning id`, [sam]);
  assert.equal(await errorOf(db, `insert into public.daily_action_logs (client_id, action_id, log_date, tick) values ($1, $2, '2026-11-11', true)`, [sam, done]), null);
  assert.ok(await errorOf(db, `insert into public.daily_action_logs (client_id, action_id, log_date, tick) values ($1, $2, '2026-11-11', true)`, [sam, done]));
  assert.equal(await errorOf(db, `insert into public.daily_action_logs (client_id, action_id, log_date, amount) values ($1, $2, '2026-11-11', 1)`, [sam, gym]), null);
  assert.ok(await errorOf(db, `insert into public.daily_action_logs (client_id, action_id, log_date, amount) values ($1, $2, '2026-11-11', 1)`, [sam, gym]));
});

test("no logging against someone else's action", async () => {
  await asUser(db, robin);
  assert.ok(await errorOf(db, `insert into public.daily_action_logs (client_id, action_id, log_date, tick) values ($1, $2, '2026-11-11', true)`, [robin, gym]));
  assert.equal(await val(db, `select count(*)::int from public.daily_actions`), 0);
});

test("the coach sees a shared action and its logs, never a private one, a timer or a check-in", async () => {
  await asUser(db, sam);
  await db.query(`insert into public.daily_action_logs (client_id, action_id, log_date, seconds, source) values ($1, $2, '2026-11-11', 420, 'manual')`, [sam, meditation]);
  await db.query(`insert into public.daily_checkins (client_id, checkin_date, rating) values ($1, '2026-11-11', 4)`, [sam]);
  await asUser(db, coach);
  assert.deepEqual((await db.query<{ name: string }>(`select name from public.daily_actions order by name`)).rows.map((r) => r.name), ["Gym"]);
  assert.equal(await val(db, `select count(*)::int from public.daily_action_logs where action_id = $1`, [gym]), 1);
  assert.equal(await val(db, `select count(*)::int from public.daily_action_logs where action_id = $1`, [meditation]), 0);
  assert.equal(await val(db, `select count(*)::int from public.daily_checkins`), 0);
  // Reading only: an edit by the coach changes nothing.
  await db.query(`update public.daily_actions set name = 'Coach edit' where id = $1`, [gym]);
  await asUser(db, sam);
  assert.equal(await val(db, `select name from public.daily_actions where id = $1`, [gym]), "Gym");
});

test("the timer logs the actual time, once, and only one runs at a time", async () => {
  await asUser(db, sam);
  // Started 7 minutes ago for 10: finishing early logs 7, not 10.
  await db.query(`insert into public.mindful_timers (client_id, action_id, planned_seconds, started_at) values ($1, $2, 600, now() - interval '7 minutes')`, [sam, meditation]);
  assert.ok(await errorOf(db, `insert into public.mindful_timers (client_id, action_id, planned_seconds) values ($1, $2, 300)`, [sam, meditation]), "one timer at a time");
  const first = (await db.query<{ logged_seconds: number }>(`select * from public.mindful_timer_finish('2026-11-11')`)).rows;
  assert.equal(first.length, 1);
  assert.ok(first[0].logged_seconds >= 419 && first[0].logged_seconds <= 421, `logged ${first[0].logged_seconds}`);
  const again = (await db.query(`select * from public.mindful_timer_finish('2026-11-11')`)).rows;
  assert.equal(again.length, 0, "a second finish logs nothing");
  // Left running past the end: it stops at the planned length.
  await db.query(`insert into public.mindful_timers (client_id, action_id, planned_seconds, started_at) values ($1, $2, 300, now() - interval '20 minutes')`, [sam, meditation]);
  assert.equal((await db.query<{ logged_seconds: number }>(`select * from public.mindful_timer_finish('2026-11-11')`)).rows[0].logged_seconds, 300);
  // Paused time doesn't count.
  await db.query(`insert into public.mindful_timers (client_id, action_id, planned_seconds, started_at, paused_seconds) values ($1, $2, 1200, now() - interval '10 minutes', 240)`, [sam, meditation]);
  const paused = (await db.query<{ logged_seconds: number }>(`select * from public.mindful_timer_finish('2026-11-11')`)).rows[0].logged_seconds;
  assert.ok(paused >= 359 && paused <= 361, `logged ${paused}`);
  assert.equal(await val(db, `select count(*)::int from public.daily_action_logs where action_id = $1 and source = 'timer'`, [meditation]), 3);
  await asUser(db, robin);
  assert.equal((await db.query(`select * from public.mindful_timer_finish('2026-11-11')`)).rows.length, 0);
});

test("a check-in links only to their own journal entry", async () => {
  await asUser(db, robin);
  const robinEntry = await val<string>(db, `insert into public.journal_entries (client_id, entry_date, body) values ($1, '2026-11-11', 'Robin''s note') returning id`, [robin]);
  await asUser(db, sam);
  assert.ok(await errorOf(db, `update public.daily_checkins set journal_entry_id = $2 where client_id = $1`, [sam, robinEntry]));
  const mine = await val<string>(db, `insert into public.journal_entries (client_id, entry_date, body, action_id) values ($1, '2026-11-11', 'Calmer after ten minutes', $2) returning id`, [sam, meditation]);
  assert.equal(await errorOf(db, `update public.daily_checkins set journal_entry_id = $2 where client_id = $1`, [sam, mine]), null);
});
