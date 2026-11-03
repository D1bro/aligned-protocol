-- 0024_life_months.sql
-- Phase 4 of the build clarifications (3 Nov 2026): My Journey and 1,000
-- Months. Free for every member and private to them, like the journal:
-- deliberately no coach or admin policy. Nothing existing is changed.
--
-- life_details        the optional date of birth. The app uses only its
--                     month and year, and never shows an age, months
--                     remaining or an end date.
-- month_reflections   one per member per month: a colour they choose
--                     (never assigned for them) and/or a few words.
--                     `month` is the first day of the month.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.life_details (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  birth_date  date check (birth_date >= date '1900-01-01'),
  updated_at  timestamptz not null default now()
);
alter table public.life_details enable row level security;
revoke all on public.life_details from public, anon, service_role;
grant select, insert, update, delete on public.life_details to authenticated;
drop policy if exists "life_details: member owns private row" on public.life_details;
create policy "life_details: member owns private row" on public.life_details for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop trigger if exists life_details_updated_at on public.life_details;
create trigger life_details_updated_at before update on public.life_details for each row execute function public.set_updated_at();

create table if not exists public.month_reflections (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  colour      text check (colour in ('inspired', 'aligned', 'growing', 'restoring', 'navigating', 'drifting')),
  reflection  text check (length(reflection) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, month),
  check (colour is not null or coalesce(length(trim(reflection)), 0) > 0)
);
alter table public.month_reflections enable row level security;
revoke all on public.month_reflections from public, anon, service_role;
grant select, insert, update, delete on public.month_reflections to authenticated;
drop policy if exists "month_reflections: member owns private rows" on public.month_reflections;
create policy "month_reflections: member owns private rows" on public.month_reflections for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop trigger if exists month_reflections_updated_at on public.month_reflections;
create trigger month_reflections_updated_at before update on public.month_reflections for each row execute function public.set_updated_at();
-- Deliberately no coach or admin policy: both are private.
