// The daily log and the Next Step review (migration 0032): a tick per move
// per day, only for the member's own moves; "done when" counted; the coach's
// review, which the member can read and answer once it's sent but never
// rewrite. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, goal: string, move: string, robinMove: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  await db.query(`update public.profiles set coach_id = $2 where id = $1`, [sam, coach]);
  await asUser(db, sam);
  const plan = await val<string>(db, `insert into public.clear_plans (client_id) values ($1) returning id`, [sam]);
  goal = await val<string>(db, `insert into public.goals (client_id, clear_plan_id, goal_title, start_score, aim_score) values ($1, $2, 'Back to the gym twice a week', 6, 7) returning id`, [sam, plan]);
  move = await val<string>(db, `insert into public.goal_moves (client_id, goal_id, body, when_text) values ($1, $2, 'Spin class', 'Monday and Thursday') returning id`, [sam, goal]);
  await asUser(db, robin);
  const rPlan = await val<string>(db, `insert into public.clear_plans (client_id) values ($1) returning id`, [robin]);
  const rGoal = await val<string>(db, `insert into public.goals (client_id, clear_plan_id, goal_title) values ($1, $2, 'Robin''s step') returning id`, [robin, rPlan]);
  robinMove = await val<string>(db, `insert into public.goal_moves (client_id, goal_id, body) values ($1, $2, 'Robin''s move') returning id`, [robin, rGoal]);
});

const tick = (as: string, moveId: string, date: string) =>
  errorOf(db, `insert into public.plan_actions (client_id, goal_id, move_id, action_date, source, body, done_at) values ($1, $2, $3, $4, 'move', 'Spin class', now())`, [as, goal, moveId, date]);

test("a member ticks a move once a day", async () => {
  await asUser(db, sam);
  assert.equal(await tick(sam, move, "2026-11-23"), null);
  assert.equal(await tick(sam, move, "2026-11-26"), null);
  assert.ok(await tick(sam, move, "2026-11-23"), "a second tick the same day is refused");
  assert.equal(await val(db, `select count(*)::int from public.plan_actions where move_id = $1`, [move]), 2);
});

test("a tick can't be for someone else's move, and the coach reads but can't tick", async () => {
  await asUser(db, sam);
  assert.ok(await tick(sam, robinMove, "2026-11-24"));
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions where move_id = $1`, [move]), 2);
  assert.ok(await tick(sam, move, "2026-11-27"));
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions`), 0);
});

test("editing a move away keeps its ticks", async () => {
  await asUser(db, sam);
  const gone = await val<string>(db, `insert into public.goal_moves (client_id, goal_id, body) values ($1, $2, 'Old move') returning id`, [sam, goal]);
  assert.equal(await tick(sam, gone, "2026-11-25"), null);
  await db.query(`delete from public.goal_moves where id = $1`, [gone]);
  assert.equal(await val(db, `select count(*)::int from public.plan_actions where source = 'move' and move_id is null`), 1);
});

test("done when, counted: a sensible number of one of their moves", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `update public.goals set count_target = 8, count_move_id = $2 where id = $1`, [goal, move]), null);
  assert.ok(await errorOf(db, `update public.goals set count_target = 0 where id = $1`, [goal]));
});

test("the coach drafts a review; the member sees it only once it's sent", async () => {
  await asUser(db, coach);
  assert.equal(
    await errorOf(db, `insert into public.next_step_reviews (goal_id, client_id, author_id, content) values ($1, $2, $3, '{"why":"I want to walk home feeling taller."}')`, [goal, sam, coach]),
    null
  );
  assert.ok(
    await errorOf(db, `insert into public.next_step_reviews (goal_id, client_id, author_id, content) values ($1, $2, $3, '{}')`, [goal, sam, coach]),
    "one review in hand per Next Step"
  );
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.next_step_reviews`), 0);
  await asUser(db, coach);
  await db.query(`update public.next_step_reviews set sent_at = now() where goal_id = $1`, [goal]);
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.next_step_reviews`), 1);
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.next_step_reviews`), 0);
});

test("the member answers but can't rewrite the coach's words", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `update public.next_step_reviews set content = '{"why":"changed"}' where goal_id = $1`, [goal]));
  assert.ok(await errorOf(db, `insert into public.next_step_reviews (goal_id, client_id, content, sent_at) values ($1, $2, '{}', now())`, [goal, sam]));
  assert.equal(await errorOf(db, `update public.next_step_reviews set answer = 'kept', answered_at = now() where goal_id = $1`, [goal]), null);
  assert.equal(await val(db, `select answer from public.next_step_reviews where goal_id = $1`, [goal]), "kept");
});

test("a coach can't review someone else's client", async () => {
  await asUser(db, robin);
  const robinGoal = await val<string>(db, `select id from public.goals where client_id = $1`, [robin]);
  await asUser(db, coach);
  assert.ok(await errorOf(db, `insert into public.next_step_reviews (goal_id, client_id, author_id, content) values ($1, $2, $3, '{}')`, [robinGoal, robin, coach]));
  assert.ok(
    await errorOf(db, `insert into public.next_step_reviews (goal_id, client_id, author_id, content) values ($1, $2, $3, '{}')`, [robinGoal, sam, coach]),
    "nor pin someone else's Next Step on their own client"
  );
});
