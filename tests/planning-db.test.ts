// Connected planning (migration 0023): monthly intentions, today's actions and
// dismissed "What's changed" suggestions. A member writes only their own, and
// only against their own goals and audits; their coach can read the first two.
// Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, goal: string, robinGoal: string, audit: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coach, sam]);
  await asUser(db, sam);
  goal = await val<string>(db, `insert into public.goals (client_id, goal_title) values ($1, 'Check my spending every Sunday') returning id`, [sam]);
  audit = await val<string>(db, `insert into public.audits (client_id, sequence_number) values ($1, 1) returning id`, [sam]);
  await asUser(db, robin);
  robinGoal = await val<string>(db, `insert into public.goals (client_id, goal_title) values ($1, 'Walk at lunch') returning id`, [robin]);
});

test("one intention a month, in their words, on the first of the month", async () => {
  await asUser(db, sam);
  const add = (month: string, words: string) =>
    errorOf(db, `insert into public.monthly_intentions (client_id, month, intention, goal_id) values ($1, $2, $3, $4)`, [sam, month, words, goal]);
  assert.equal(await add("2026-11-01", "Calm about money"), null);
  assert.ok(await add("2026-11-01", "A second one"), "only one per month");
  assert.ok(await add("2026-12-03", "Not the first"), "month is the first day");
  assert.ok(await add("2026-12-01", "   "), "not blank");
});

test("a member can't link an intention or action to someone else's goal", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `insert into public.monthly_intentions (client_id, month, intention, goal_id) values ($1, '2027-01-01', 'Mine', $2)`, [sam, robinGoal]));
  assert.ok(await errorOf(db, `insert into public.plan_actions (client_id, goal_id, action_date, body) values ($1, $2, '2026-11-03', 'Mine')`, [sam, robinGoal]));
  assert.ok(await errorOf(db, `insert into public.plan_actions (client_id, action_date, body) values ($1, '2026-11-03', 'As Robin')`, [robin]));
});

test("the plan's action can be ticked once a day; own actions as often as they like", async () => {
  await asUser(db, sam);
  const tick = `insert into public.plan_actions (client_id, goal_id, action_date, source, body, done_at) values ($1, $2, '2026-11-03', 'plan', 'Check my spending', now())`;
  assert.equal(await errorOf(db, tick, [sam, goal]), null);
  assert.ok(await errorOf(db, tick, [sam, goal]));
  const own = `insert into public.plan_actions (client_id, goal_id, action_date, body) values ($1, $2, '2026-11-03', 'Cancel the gym trial')`;
  assert.equal(await errorOf(db, own, [sam, goal]), null);
  assert.equal(await errorOf(db, own, [sam, goal]), null);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions`), 3);
});

test("their coach can read them; nobody else can", async () => {
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.monthly_intentions`), 1);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions`), 3);
  assert.ok(await errorOf(db, `update public.plan_actions set done_at = now()`) === null);
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions where done_at is not null`), 1, "the coach's update changed nothing");
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.monthly_intentions`), 0);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions`), 0);
});

test("suggestions are dismissed per audit, only for their own audits", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.plan_suggestion_dismissals (client_id, audit_id) values ($1, $2)`, [sam, audit]), null);
  await asUser(db, robin);
  assert.ok(await errorOf(db, `insert into public.plan_suggestion_dismissals (client_id, audit_id) values ($1, $2)`, [robin, audit]));
  assert.equal(await val(db, `select count(*)::int from public.plan_suggestion_dismissals`), 0);
});
