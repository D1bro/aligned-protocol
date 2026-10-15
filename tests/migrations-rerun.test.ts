// Database updates 0012 onwards must be safe to run again, including after
// one stopped partway (which happened on the live project with 0013).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { STUB } from "./db-harness.ts";

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = (f: string) => readFileSync(new URL(f, dir), "utf8");
const late = files.filter((f) => f >= "0012");
async function upTo(first: string) {
  const db = new PGlite();
  await db.exec(STUB);
  for (const f of files.filter((f) => f < first)) await db.exec(sql(f));
  return db;
}
const shape = async (db: PGlite) =>
  (await db.query<{ n: string }>(`select concat_ws('/',
     (select count(*) from pg_policies where schemaname = 'public'),
     (select count(*) from pg_trigger where not tgisinternal),
     (select count(*) from pg_tables where schemaname = 'public'),
     (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')) as n`)).rows[0].n;

test("running 0012 onwards twice gives the same database", async () => {
  const db = await upTo("0012");
  for (const f of late) await db.exec(sql(f));
  const once = await shape(db);
  for (const f of late) await db.exec(sql(f));
  assert.equal(await shape(db), once);
});

test("a half-applied 0013 is completed by running 0013 onwards again", async () => {
  const db = await upTo("0013");
  const s13 = sql("0013_coaching_core.sql");
  await db.exec(s13.slice(0, s13.indexOf("create table if not exists public.coaching_sessions")));
  for (const f of late.filter((f) => f >= "0013")) await db.exec(sql(f));
  const clean = await upTo("0012");
  for (const f of late) await clean.exec(sql(f));
  assert.equal(await shape(db), await shape(clean));
});
