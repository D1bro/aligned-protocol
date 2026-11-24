-- 0038_followup_console.sql
-- Console → Follow-up emails (Duane, 24 Nov 2026): edit the wording of the
-- eight follow-up emails, and pause them all.
--
-- Additive. Until something is saved here, the emails use the wording in
-- lib/followup-content.ts. Admins only; the daily job reads it with the
-- service role.

-- 1. Duane's wording for each of the eight emails, where he's changed it.
--    key = "<day>-<new|set>": day 1, 3, 7 or 10; new = no Next Step yet,
--    set = Next Step set. Paragraphs are separated by a blank line.
create table if not exists public.followup_copy (
  key         text primary key check (key in ('1-new', '1-set', '3-new', '3-set', '7-new', '7-set', '10-new', '10-set')),
  subject     text not null check (length(btrim(subject)) between 1 and 120),
  preheader   text not null default '' check (length(preheader) <= 160),
  body        text not null check (length(btrim(body)) between 1 and 4000),
  button      text not null check (length(btrim(button)) between 1 and 40),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);
alter table public.followup_copy enable row level security;
drop policy if exists "followup_copy: admins" on public.followup_copy;
create policy "followup_copy: admins" on public.followup_copy for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.followup_copy from anon;

-- 2. Pauses. While a pause is open (ended_at null) nothing is sent, and the
--    paused days don't count towards anyone's day 1, 3, 7 or 10, so nobody
--    loses their place.
create table if not exists public.followup_pauses (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  started_by  uuid references public.profiles(id) on delete set null,
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists followup_pauses_one_open on public.followup_pauses ((true)) where ended_at is null;
alter table public.followup_pauses enable row level security;
drop policy if exists "followup_pauses: admins" on public.followup_pauses;
create policy "followup_pauses: admins" on public.followup_pauses for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.followup_pauses from anon;
