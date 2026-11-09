// Coach basics and client admin (migration 0027). Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let casey: string, alex: string, admin: string, sam: string, robin: string;

before(async () => {
  db = await freshDb();
  casey = await makeUser(db, "casey@example.com", "coach", "Casey Coach");
  alex = await makeUser(db, "alex@example.com", "coach", "Alex Coach");
  admin = await makeUser(db, "admin@example.com", "admin", "Ada Admin");
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await asOwner(db);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [casey, sam]);
  await db.query(`update public.profiles set coach_id = $1 where id = $2`, [alex, robin]);
});

test("a coach keeps their basics; admins read them; clients see only their own coach, through my_coach()", async () => {
  await asUser(db, casey);
  assert.equal(await errorOf(db, `insert into public.coach_public (coach_id, bio, credentials, meeting_link, default_minutes) values ($1, 'I help people move.', 'ICF ACC', 'https://meet.example.com/casey', 60)`, [casey]), null);
  assert.ok(await errorOf(db, `update public.coach_public set meeting_link = 'http://insecure.example.com' where coach_id = $1`, [casey]), "https only");
  await asUser(db, admin);
  assert.equal(await val(db, `select count(*)::int from public.coach_public`), 1);
  await asUser(db, alex);
  assert.equal(await val(db, `select count(*)::int from public.coach_public`), 0, "another coach can't read it");
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.coach_public`), 0, "not the table itself");
  assert.equal(await val(db, `select bio from public.my_coach()`), "I help people move.");
  assert.equal(await val(db, `select full_name from public.my_coach()`), "Casey Coach");
  await asUser(db, robin);
  assert.equal(await val(db, `select bio from public.my_coach()`), "", "Robin's coach has no basics yet");
});

test("client records are for admins and the client's coach; admin notes for admins only", async () => {
  await asUser(db, casey);
  assert.equal(await errorOf(db, `insert into public.client_records (client_id, status, started_on, source) values ($1, 'active', '2026-09-01', 'Instagram')`, [sam]), null);
  assert.ok(await errorOf(db, `insert into public.client_records (client_id) values ($1)`, [robin]), "not Casey's client");
  assert.ok(await errorOf(db, `update public.client_records set status = 'gone' where client_id = $1`, [sam]));
  assert.ok(await errorOf(db, `insert into public.client_admin_notes (client_id, notes) values ($1, 'x')`, [sam]), "coaches can't write admin notes");
  await asUser(db, admin);
  assert.equal(await errorOf(db, `insert into public.client_admin_notes (client_id, notes) values ($1, 'Pays by bank transfer')`, [sam]), null);
  await asUser(db, casey);
  assert.equal(await val(db, `select count(*)::int from public.client_admin_notes`), 0, "or read them");
  await asUser(db, sam);
  assert.equal(await val(db, `select count(*)::int from public.client_records`), 0, "clients can't see their record");
});

test("staff update a client's details on their behalf, only for their own clients", async () => {
  await asUser(db, casey);
  assert.equal(await errorOf(db, `select public.staff_save_client_details($1, 'Sam Fictional', 'Sammy', '+44 7700 900000', 'Leeds', 'UK', 'Europe/London')`, [sam]), null);
  assert.equal(await val(db, `select preferred_name from public.profiles where id = $1`, [sam]), "Sammy");
  assert.ok(await errorOf(db, `select public.staff_save_client_details($1, 'Robin', '', '', '', '', '')`, [robin]), "not Casey's client");
  assert.ok(await errorOf(db, `select public.staff_save_client_details($1, '  ', '', '', '', '', '')`, [sam]), "a name is needed");
  await asUser(db, sam);
  assert.ok(await errorOf(db, `select public.staff_save_client_details($1, 'Robin', '', '', '', '', '')`, [robin]), "clients can't");
});
