// Migration 0036: the alert log is server-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./db-harness.ts";

test("coach_alerts exists, is locked to signed-in people, and checks its kinds", async () => {
  const db = await freshDb();
  await db.exec(`insert into public.coach_alerts (kind, subject, ok, reason) values ('test', 'Test alert', false, 'resend 403: domain not verified')`);
  const rows = await db.query<{ n: number }>(`select count(*)::int as n from public.coach_alerts`);
  assert.equal(rows.rows[0].n, 1);
  await assert.rejects(db.exec(`insert into public.coach_alerts (kind, subject, ok) values ('other', 'x', true)`));
  await db.exec(`set role authenticated`);
  await assert.rejects(db.query(`select * from public.coach_alerts`));
  await db.exec(`reset role`);
});
