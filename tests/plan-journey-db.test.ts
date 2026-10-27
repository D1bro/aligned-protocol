// Build your plan and the weekly review (migration 0021): weekly reviews
// share goal_checkins without a score; monthly reviews still need one; a
// member only ever writes their own. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, goal: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await asUser(db, sam);
  const plan = await val<string>(db, `insert into public.clear_plans (client_id, why_it_matters) values ($1, 'Tired of the dread every payday') returning id`, [sam]);
  goal = await val<string>(
    db,
    `insert into public.goals (client_id, clear_plan_id, goal_title, action_when) values ($1, $2, 'Every Sunday at 6pm, I’ll check my spending.', 'Every Sunday at 6pm') returning id`,
    [sam, plan]
  );
});

const weekly = (didIt: string, next: string) =>
  `insert into public.goal_checkins (client_id, goal_id, kind, did_it, next_step, next_commitment) values ($1, $2, 'weekly', '${didIt}', '${next}', 'Same again on Sunday')`;

test("a weekly review needs no score, and takes the weekly answers", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, weekly("done", "keep"), [sam, goal]), null);
  assert.equal(await errorOf(db, weekly("missed", "smaller"), [sam, goal]), null);
  assert.equal(await errorOf(db, weekly("partly", "change"), [sam, goal]), null);
  assert.ok(await errorOf(db, weekly("made_up", "keep"), [sam, goal]));
});

test("a monthly review still needs the area's score, and old check-ins count as monthly", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `insert into public.goal_checkins (client_id, goal_id, did_it, next_step) values ($1, $2, 'most', 'keep')`, [sam, goal]));
  assert.equal(
    await errorOf(db, `insert into public.goal_checkins (client_id, goal_id, did_it, area_score, next_step) values ($1, $2, 'most', 6, 'keep')`, [sam, goal]),
    null
  );
  assert.equal(await val(db, `select kind from public.goal_checkins where area_score = 6`), "monthly");
});

test("nobody can add a review to someone else's goal", async () => {
  await asUser(db, robin);
  assert.ok(await errorOf(db, weekly("done", "keep"), [robin, goal]));
  assert.ok(await errorOf(db, weekly("done", "keep"), [sam, goal]));
});
