// The Next Step (migration 0029): moves are the member's own (their coach
// can read them), the new scores stay 1–10, the weekly check-in takes
// "is it closer?", and existing plans become Next Steps when it runs.
// Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshDb, asOwner, asUser, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, coach: string, goal: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  coach = await makeUser(db, "coach@example.com", "coach", "Casey Coach");
  await db.query(`update public.profiles set coach_id = $2 where id = $1`, [sam, coach]);
  await asUser(db, sam);
  const plan = await val<string>(db, `insert into public.clear_plans (client_id) values ($1) returning id`, [sam]);
  goal = await val<string>(
    db,
    `insert into public.goals (client_id, clear_plan_id, goal_title, start_score, aim_score) values ($1, $2, 'Sign one client at £[X] a month', 3, 5) returning id`,
    [sam, plan]
  );
});

const addMove = (as: string, body = "Write my offer on one page") =>
  errorOf(db, `insert into public.goal_moves (client_id, goal_id, body, when_text) values ($1, $2, $3, 'By Friday')`, [as, goal, body]);

test("a member adds and ticks their own moves", async () => {
  await asUser(db, sam);
  assert.equal(await addMove(sam), null);
  assert.equal(await errorOf(db, `update public.goal_moves set done_at = now() where goal_id = $1`, [goal]), null);
  assert.equal(await val(db, `select count(*)::int from public.goal_moves where done_at is not null`), 1);
  assert.ok(await addMove(sam, "   "), "an empty move is refused");
});

test("nobody else can see or add moves, but the member's coach can read them", async () => {
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from public.goal_moves`), 0);
  assert.ok(await addMove(robin));
  assert.ok(await addMove(sam));
  await asUser(db, coach);
  assert.equal(await val(db, `select count(*)::int from public.goal_moves`), 1);
  assert.ok(await addMove(sam), "the coach can't write a member's moves");
});

test("scores stay 1–10 and the three checks are an object", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, `update public.goals set aim_score = 11 where id = $1`, [goal]));
  assert.ok(await errorOf(db, `update public.goals set taken_score = 0 where id = $1`, [goal]));
  assert.ok(await errorOf(db, `update public.goals set step_checks = '[true]' where id = $1`, [goal]));
  assert.equal(await errorOf(db, `update public.goals set step_checks = '{"different":true,"reach":true,"visible":false}' where id = $1`, [goal]), null);
});

test("the weekly check-in takes closer / same / further, with no 'did it' answer", async () => {
  await asUser(db, sam);
  const checkin = (closer: string) =>
    errorOf(db, `insert into public.goal_checkins (client_id, goal_id, kind, closer, helped) values ($1, $2, 'weekly', $3, 'Two calls booked')`, [sam, goal, closer]);
  assert.equal(await checkin("closer"), null);
  assert.equal(await checkin("further"), null);
  assert.ok(await checkin("sideways"));
});

test("running it turns an existing plan into a Next Step, once", async () => {
  await asUser(db, robin);
  const area = await val<string>(db, `select id from public.life_areas order by sort_order limit 1`);
  const audit = await val<string>(db, `insert into public.audits (client_id, sequence_number) values ($1, 1) returning id`, [robin]);
  await db.query(`insert into public.audit_responses (audit_id, life_area_id, satisfaction_score, importance_score) values ($1, $2, 4, 5)`, [audit, area]);
  const plan = await val<string>(
    db,
    `insert into public.clear_plans (client_id, audit_id, life_area_id, step_up_target) values ($1, $2, $3, 5) returning id`,
    [robin, audit, area]
  );
  const old = await val<string>(
    db,
    `insert into public.goals (client_id, clear_plan_id, goal_title, action_text, action_when, frequency, success_criteria)
     values ($1, $2, 'Every Tuesday, I’ll call family.', 'call family', 'Every Tuesday', 'Weekly', 'We talk most weeks') returning id`,
    [robin, plan]
  );
  await asOwner(db);
  const sql = readFileSync(new URL("../supabase/migrations/0029_next_step.sql", import.meta.url), "utf8");
  await db.exec(sql);
  await db.exec(sql);
  const row = (await db.query<{ start_score: number; aim_score: number; set: boolean }>(
    `select start_score, aim_score, set_at is not null as set from public.goals where id = $1`, [old])).rows[0];
  assert.deepEqual(row, { start_score: 4, aim_score: 5, set: true });
  const moves = (await db.query<{ body: string; when_text: string }>(`select body, when_text from public.goal_moves where goal_id = $1`, [old])).rows;
  assert.deepEqual(moves, [{ body: "call family", when_text: "Every Tuesday" }]);
  assert.equal(await val(db, `select count(*)::int from public.goal_moves where goal_id = $1`, [goal]), 1, "a Next Step's own moves are left alone");
});
