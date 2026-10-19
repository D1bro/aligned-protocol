// Who can see and change coaching records (migration 0013): sessions,
// private notes and transcripts, summaries, agreed actions, member updates
// and preparation. Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let admin: string, coachA: string, coachB: string, sam: string, robin: string;
let samSession: string, robinSession: string, summary1: string;

const count = (sql: string, params: unknown[] = []) => val<number>(db, `select count(*)::int from (${sql}) x`, params);
const content = (client: string[], coach: { text: string; visible: boolean }[]) =>
  JSON.stringify({ overview: "Fictional overview", client_actions: client.map((text) => ({ text })), coach_actions: coach });

before(async () => {
  db = await freshDb();
  admin = await makeUser(db, "admin@example.com", "admin");
  coachA = await makeUser(db, "coach.a@example.com", "coach");
  coachB = await makeUser(db, "coach.b@example.com", "coach");
  sam = await makeUser(db, "sam@example.com");
  robin = await makeUser(db, "robin@example.com");
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coachA, sam]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [coachB, robin]);

  await asUser(db, coachA);
  samSession = await val(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now() - interval '1 day', 'held', $2) returning id`, [sam, coachA]);
  await db.query(`insert into public.coach_notes (client_id, session_id, author_id, body) values ($1, $2, $3, 'Private: fictional note')`, [sam, samSession, coachA]);
  await db.query(`insert into public.session_transcripts (client_id, session_id, source, content_hash, content, created_by) values ($1, $2, 'paste', 'h1', 'Fictional transcript', $3)`, [sam, samSession, coachA]);
  summary1 = await val(db, `insert into public.session_summaries (session_id, client_id, revision, content, created_by) values ($1, $2, 1, $3::jsonb, $4) returning id`, [
    samSession, sam, content(["Plan Monday priorities"], [{ text: "Send the worksheet", visible: true }, { text: "Coach-only reminder", visible: false }]), coachA,
  ]);

  await asUser(db, coachB);
  robinSession = await val(db, `insert into public.coaching_sessions (client_id, coach_id, scheduled_at, state, created_by) values ($1, $2, now(), 'confirmed', $2) returning id`, [robin, coachB]);
});

test("members see only their own sessions", async () => {
  await asUser(db, sam);
  assert.equal(await count(`select id from public.coaching_sessions`), 1);
  assert.equal(await count(`select id from public.coaching_sessions where id = $1`, [robinSession]), 0);
  await asUser(db, robin);
  assert.equal(await count(`select id from public.coaching_sessions where id = $1`, [samSession]), 0);
});

test("a coach can book sessions for their own clients only", async () => {
  await asUser(db, coachB);
  assert.ok(await errorOf(db, `insert into public.coaching_sessions (client_id, scheduled_at) values ($1, now())`, [sam]));
  assert.equal(await count(`select id from public.coaching_sessions where client_id = $1`, [sam]), 0);
  await asUser(db, coachA);
  assert.equal(await count(`select id from public.coaching_sessions where client_id = $1`, [sam]), 1);
});

test("private notes and transcripts: the assigned coach only — never the member, another coach or an admin", async () => {
  for (const [who, expected] of [[coachA, 1], [sam, 0], [robin, 0], [coachB, 0], [admin, 0]] as const) {
    await asUser(db, who);
    assert.equal(await count(`select id from public.coach_notes`), expected, `notes for ${who}`);
    assert.equal(await count(`select id from public.session_transcripts`), expected, `transcripts for ${who}`);
  }
});

test("a draft summary is invisible to the member until it is approved and published", async () => {
  await asUser(db, sam);
  assert.equal(await count(`select id from public.session_summaries`), 0);

  await asUser(db, coachA);
  assert.match((await errorOf(db, `select public.publish_session_summary($1, 1)`, [summary1]))!, /Approve the latest wording/);
  await db.query(`update public.session_summaries set status = 'approved', approved_by = $2, approved_at = now(), approved_version = version where id = $1`, [summary1, coachA]);
  assert.equal(await val(db, `select public.publish_session_summary($1, 1)`, [summary1]), 1);
  // A retry is harmless and creates nothing twice.
  assert.equal(await val(db, `select public.publish_session_summary($1, 1)`, [summary1]), 1);
  assert.equal(await count(`select id from public.session_commitments where summary_id = $1`, [summary1]), 3);

  await asUser(db, sam);
  assert.equal(await count(`select id from public.session_summaries where status = 'published'`), 1);
  await asUser(db, robin);
  assert.equal(await count(`select id from public.session_summaries`), 0);
});

test("agreed actions: the member sees theirs and visible coach actions, never hidden ones or anyone else's", async () => {
  await asUser(db, sam);
  const bodies = (await db.query<{ body: string }>(`select body from public.session_commitments order by position`)).rows.map((r) => r.body);
  assert.deepEqual(bodies, ["Plan Monday priorities", "Send the worksheet"]);
  await asUser(db, robin);
  assert.equal(await count(`select id from public.session_commitments`), 0);
  await asUser(db, coachB);
  assert.equal(await count(`select id from public.session_commitments where client_id = $1`, [sam]), 0);
});

test("action updates: the member writes their own, the coach reads them, nobody else can", async () => {
  await asUser(db, sam);
  const mine = await val<string>(db, `select id from public.session_commitments where owner = 'client' limit 1`);
  assert.equal(await errorOf(db, `insert into public.commitment_updates (commitment_id, client_id, author_id, progress, note) values ($1, $2, $2, 'partly', 'Did two Mondays')`, [mine, sam]), null);

  await asOwner(db);
  const hidden = await val<string>(db, `select id from public.session_commitments where body = 'Coach-only reminder'`);
  await asUser(db, sam);
  assert.ok(await errorOf(db, `insert into public.commitment_updates (commitment_id, client_id, author_id, progress) values ($1, $2, $2, 'done')`, [hidden, sam]), "can't update a hidden action");

  await asUser(db, robin);
  assert.ok(await errorOf(db, `insert into public.commitment_updates (commitment_id, client_id, author_id, progress) values ($1, $2, $2, 'done')`, [mine, robin]), "can't update someone else's action");
  assert.equal(await count(`select id from public.commitment_updates`), 0);

  await asUser(db, coachA);
  assert.equal(await count(`select id from public.commitment_updates where client_id = $1`, [sam]), 1);
  await asUser(db, coachB);
  assert.equal(await count(`select id from public.commitment_updates`), 0);
});

test("preparation stays private until the member deliberately shares it", async () => {
  await asUser(db, sam);
  await db.query(`insert into public.prep_drafts (client_id, session_id, content) values ($1, $2, 'Private draft thoughts')`, [sam, samSession]);
  await asUser(db, coachA);
  assert.equal(await count(`select id from public.prep_drafts`), 0, "drafts are never visible to the coach");
  assert.equal(await count(`select id from public.prep_shares`), 0);

  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into public.prep_shares (client_id, session_id, content) values ($1, $2, 'What I want to talk about')`, [sam, samSession]), null);
  assert.ok(await errorOf(db, `insert into public.prep_shares (client_id, session_id, content) values ($1, $2, 'x')`, [sam, robinSession]), "can't attach to someone else's session");

  await asUser(db, coachA);
  assert.equal(await count(`select id from public.prep_shares`), 1);
  await asUser(db, coachB);
  assert.equal(await count(`select id from public.prep_shares`), 0);
  await asUser(db, robin);
  assert.equal(await count(`select id from public.prep_shares`), 0);
});

test("continuity: a published summary is frozen; a new revision supersedes it and earlier actions and updates remain", async () => {
  await asUser(db, coachA);
  assert.match((await errorOf(db, `update public.session_summaries set content = '{}'::jsonb where id = $1`, [summary1]))!, /can't be changed/);

  const summary2 = await val<string>(db, `insert into public.session_summaries (session_id, client_id, revision, content, created_by) values ($1, $2, 2, $3::jsonb, $4) returning id`, [
    samSession, sam, content(["Review the week on Friday"], []), coachA,
  ]);
  await asUser(db, sam);
  assert.equal(await val(db, `select revision from public.session_summaries where status = 'published'`), 1, "member still sees the published one");

  await asUser(db, coachA);
  await db.query(`update public.session_summaries set status = 'approved', approved_by = $2, approved_at = now(), approved_version = version where id = $1`, [summary2, coachA]);
  await db.query(`select public.publish_session_summary($1, 1)`, [summary2]);

  await asUser(db, sam);
  assert.equal(await val(db, `select revision from public.session_summaries where status = 'published'`), 2);
  assert.equal(await count(`select id from public.session_commitments`), 3, "actions from both revisions remain");
  assert.equal(await count(`select id from public.commitment_updates`), 1, "their earlier update remains");
});
