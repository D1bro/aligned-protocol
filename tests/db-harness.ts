// A throwaway Postgres (PGlite, in memory) with every migration applied, and
// just enough of Supabase's auth and storage schemas stubbed for them to run.
// Lets the database rules be tested without touching any Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage; create schema extensions;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}',
  is_anonymous boolean default false, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(STUB);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  return db;
}

type Db = Awaited<ReturnType<typeof freshDb>>;

// Back to the database owner (like the SQL Editor).
export async function asOwner(db: Db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);`);
}

// Act as a signed-in user, with row-level security applied.
export async function asUser(db: Db, id: string) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id}', false), set_config('request.jwt.claim.role', 'authenticated', false); set role authenticated;`);
}

export async function asService(db: Db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', 'service_role', false); set role service_role;`);
}

export async function makeUser(db: Db, email: string, role: "client" | "coach" | "admin" = "client", fullName = email.split("@")[0]) {
  await asOwner(db);
  const { rows } = await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { full_name: fullName }]);
  await db.query(`update public.profiles set role = $2, full_name = $3 where id = $1`, [rows[0].id, role, fullName]);
  return rows[0].id;
}

// Run SQL and return the first column of the first row.
export async function val<T = unknown>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : (undefined as T);
}

// The error message a statement raises, or null if it succeeded.
export async function errorOf(db: Db, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
