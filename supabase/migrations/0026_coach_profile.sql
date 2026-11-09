-- 0026_coach_profile.sql
-- The coach's own profile and what they know about each client, read by the
-- coaching reflection before it judges a session (context before critique).
-- Private to the coach who wrote them: no admin policy, no client access, as
-- Duane decided on 9 Nov 2026 (each coach's reflections are their own).
-- Nothing existing is changed.
--
-- coach_profiles    one per coach: their approach in their own words, and
--                   what they're working on (a list of learning areas,
--                   each {id, text, added}).
-- client_contexts   one per coach and client: history, what the client
--                   responds to, where they are now.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.coach_profiles (
  coach_id    uuid primary key references public.profiles(id) on delete cascade,
  approach    text not null default '' check (length(approach) <= 4000),
  working_on  jsonb not null default '[]' check (jsonb_typeof(working_on) = 'array' and jsonb_array_length(working_on) <= 12),
  updated_at  timestamptz not null default now()
);
alter table public.coach_profiles enable row level security;
revoke all on public.coach_profiles from public, anon;
grant select, insert, update, delete on public.coach_profiles to authenticated;
drop policy if exists "coach_profiles: the coach's own" on public.coach_profiles;
create policy "coach_profiles: the coach's own" on public.coach_profiles for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
drop trigger if exists coach_profiles_updated_at on public.coach_profiles;
create trigger coach_profiles_updated_at before update on public.coach_profiles for each row execute function public.set_updated_at();

create table if not exists public.client_contexts (
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  notes       text not null default '' check (length(notes) <= 4000),
  updated_at  timestamptz not null default now(),
  primary key (coach_id, client_id)
);
alter table public.client_contexts enable row level security;
revoke all on public.client_contexts from public, anon;
grant select, insert, update, delete on public.client_contexts to authenticated;
drop policy if exists "client_contexts: the coach's own, for their clients" on public.client_contexts;
create policy "client_contexts: the coach's own, for their clients" on public.client_contexts for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_my_client(client_id));
drop trigger if exists client_contexts_updated_at on public.client_contexts;
create trigger client_contexts_updated_at before update on public.client_contexts for each row execute function public.set_updated_at();
-- Deliberately no admin policy: a coach's profile and notes are their own.
