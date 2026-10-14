-- 0008_profile_plan_v2.sql
-- My profile v2: an optional identity statement in the member's own words,
-- and lesson reflections made private to the member.
-- Run in the Supabase SQL Editor before deploying the matching app change.
-- Adds one column, removes one read policy and adds one safety trigger; no
-- existing data is changed.

-- "Who I'm becoming", in their own words. Optional; shown on My profile.
alter table public.profiles add column if not exists identity_statement text;

-- Lesson reflections are private to the member. Coaches see what is shared
-- through the coaching relationship (audit, CLEAR plan, check-ins), not
-- Academy reflections. (Profiles already let a member update their own row.)
drop policy if exists "lesson_progress: coach reads own clients'" on public.lesson_progress;

-- The main goal uses the existing goals.goal_type column: the member's main
-- goal is 'primary', other active goals 'supporting'. Nothing to migrate —
-- until someone chooses, the newest active goal is treated as the main one.

-- Security fix: "profiles: update own" lets a signed-in member update any
-- column of their own row, including role and coach_id — so anyone could
-- make themselves a coach. Members may still change their own name,
-- preferences and identity statement; role, coach and the unsubscribe token
-- can only be changed by the server (service role) or the SQL Editor. Email
-- can be filled in once (a guest creating their account), not changed later.
create or replace function public.profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and (
       new.role is distinct from old.role
    or new.coach_id is distinct from old.coach_id
    or new.email_token is distinct from old.email_token
    or (old.email is not null and new.email is distinct from old.email)
  ) then
    raise exception 'This profile field can''t be changed here';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns before update on public.profiles
  for each row execute function public.profiles_guard_columns();
