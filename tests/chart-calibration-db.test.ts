// "Take your chart further" (migration 0028): the client's coach writes the
// calibrated chart for a session; the client sees it only once it's shared.
// Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let casey: string, alex: string, sam: string, robin: string, samAudit: string, robinAudit: string, samSession: string, robinSession: string;

before(async () => {
  db = await freshDb();
  casey = await makeUser(db, "casey@example.com", "coach", "Casey Coach");
  alex = await makeUser(db, "alex@example.com", "coach", "Alex Coach");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [casey, sam]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [alex, robin]);
  samAudit = await val(db, `insert into public.audits (client_id, sequence_number) values ($1, 1) returning id`, [sam]);
  robinAudit = await val(db, `insert into public.audits (client_id, sequence_number) values ($1, 1) returning id`, [robin]);
  samSession = await val(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now(), 'held', $2) returning id`, [sam, casey]);
  robinSession = await val(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now(), 'held', $2) returning id`, [robin, alex]);
});

const areas = JSON.stringify([{ life_area_id: "x", alone: 2, agreed: 6, definition: "A 10 is training four times a week and sleeping well.", focus: true }]);

test("the client's coach writes the calibrated chart; another coach can't", async () => {
  await asUser(db, casey);
  assert.equal(await errorOf(db, `insert into public.chart_calibrations (client_id, audit_id, session_id, coach_id, areas) values ($1, $2, $3, $4, $5)`, [sam, samAudit, samSession, casey, areas]), null);
  assert.ok(await errorOf(db, `insert into public.chart_calibrations (client_id, audit_id, session_id, coach_id, areas) values ($1, $2, $3, $4, $5)`, [robin, robinAudit, robinSession, casey, areas]), "not Casey's client");
  assert.ok(await errorOf(db, `insert into public.chart_calibrations (client_id, audit_id, session_id, coach_id, areas) values ($1, $2, $3, $4, $5)`, [sam, robinAudit, robinSession, casey, areas]), "audit and session must be Sam's");
  await asUser(db, alex);
  assert.equal(await val(db, `select count(*)::int from public.chart_calibrations`), 0);
});

test("the client sees it only once shared", async () => {
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.chart_calibrations`), 0, "draft is hidden");
  assert.ok(await errorOf(db, `update public.chart_calibrations set status = 'shared'`) === null);
  assert.equal(await val(db, `select count(*)::int from public.chart_calibrations`), 0, "the client can't share it themselves");
  await asUser(db, casey);
  await db.query(`update public.chart_calibrations set status = 'shared', shared_at = now() where client_id = $1`, [sam]);
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.chart_calibrations`), 1);
});
