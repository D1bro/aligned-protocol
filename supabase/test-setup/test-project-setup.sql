-- aligned-test: one-time setup for the separate TEST project only.
-- Generated from supabase/migrations in order. Do NOT run on the live project.

-- ===== supabase/migrations/0001_init.sql =====
-- ============================================================================
-- Aligned Protocol — initial schema
--
-- This formalises the data shape that coach.html was already querying against
-- (profiles.role/coach_id, audits, goals, weekly_checkins, session_notes) and
-- adds the tables the client-facing audit/CLEAR/goals flow needs, using the
-- same field names coach.html already expects — so the coach dashboard, when
-- it's ported into this app, reads real data without changing a single query.
--
-- Run this in your Supabase project's SQL Editor (Settings -> SQL Editor),
-- top to bottom, once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — one row per user, kept in sync with auth.users by trigger below.
-- role decides which app shell a person lands in after login: 'client' is the
-- default; 'coach' (or 'admin') is set by hand in the table editor for now —
-- there's no self-serve way to become a coach, which is deliberate.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'client' check (role in ('client','coach','admin')),
  coach_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Mirror of auth.users, one row per user. role + coach_id drive routing and coach-side visibility.';

create index profiles_coach_id_idx on public.profiles (coach_id);

-- ----------------------------------------------------------------------------
-- life_areas — the ten audit categories, content-managed (never hardcoded in
-- the app) so wording can change from the table editor without a redeploy.
-- ----------------------------------------------------------------------------
create table public.life_areas (
  id           uuid primary key default gen_random_uuid(),
  sort_order   integer not null,
  name         text not null,
  icon         text,
  description  text not null,
  hint         text
);
comment on table public.life_areas is 'The ten life-audit categories. Content-managed — reword/reorder here, no redeploy needed.';

-- ----------------------------------------------------------------------------
-- audits — one permanent snapshot per audit run.
-- ----------------------------------------------------------------------------
create table public.audits (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'in_progress' check (status in ('in_progress','completed')),
  sequence_number  integer not null,
  focus_area_id    uuid references public.life_areas(id),
  focus_area       text,        -- denormalised label, set at completion — this is exactly the field coach.html already reads
  total_score      integer,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (client_id, sequence_number)
);
comment on table public.audits is 'One row per audit run. Completed audits are immutable — enforced by trigger below.';

create index audits_client_id_idx on public.audits (client_id);

create table public.audit_responses (
  id                 uuid primary key default gen_random_uuid(),
  audit_id           uuid not null references public.audits(id) on delete cascade,
  life_area_id       uuid not null references public.life_areas(id),
  satisfaction_score smallint not null check (satisfaction_score between 1 and 10),
  importance_score   smallint not null check (importance_score between 1 and 5),
  priority_score     smallint generated always as (importance_score * (10 - satisfaction_score)) stored,
  note               text,
  created_at         timestamptz not null default now(),
  unique (audit_id, life_area_id)
);

-- ----------------------------------------------------------------------------
-- clear_plans — the five-step CLEAR framework off the leverage area.
-- ----------------------------------------------------------------------------
create table public.clear_plans (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  audit_id          uuid references public.audits(id),
  life_area_id      uuid references public.life_areas(id),
  current_reality   text,
  life_vision       text,
  emotional_blocks  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- goals — field names match coach.html's existing queries exactly
-- (goal_title, status, focus_area, goal_type, client_id).
-- ----------------------------------------------------------------------------
create table public.goals (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  clear_plan_id      uuid references public.clear_plans(id),
  goal_title         text not null,
  goal_type          text not null default 'supporting' check (goal_type in ('primary','supporting')),
  focus_area         text,
  action_text        text,
  frequency          text,
  success_criteria   text,
  motivation_text    text,
  start_date         date not null default current_date,
  status             text not null default 'active' check (status in ('active','completed','abandoned')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index goals_client_id_idx on public.goals (client_id);

-- ----------------------------------------------------------------------------
-- weekly_checkins — field names match coach.html exactly (clarity_score,
-- alignment_score, action_score, confidence_score, avoidance_score).
-- ----------------------------------------------------------------------------
create table public.weekly_checkins (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  goal_id            uuid references public.goals(id),
  clarity_score      smallint check (clarity_score between 1 and 10),
  alignment_score    smallint check (alignment_score between 1 and 10),
  action_score       smallint check (action_score between 1 and 10),
  confidence_score   smallint check (confidence_score between 1 and 10),
  avoidance_score    smallint check (avoidance_score between 1 and 10),
  note               text,
  created_at         timestamptz not null default now()
);
create index weekly_checkins_client_id_idx on public.weekly_checkins (client_id);

-- ----------------------------------------------------------------------------
-- session_notes — coach-authored, per client. Field names match coach.html's
-- insert exactly (client_id, coach_id, session_date, focus, note,
-- next_actions, client_mood).
-- ----------------------------------------------------------------------------
create table public.session_notes (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles(id) on delete cascade,
  coach_id       uuid not null references public.profiles(id),
  session_date   date not null,
  focus          text,
  note           text not null,
  next_actions   text,
  client_mood    smallint check (client_mood between 1 and 10),
  created_at     timestamptz not null default now()
);
create index session_notes_client_id_idx on public.session_notes (client_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Keep profiles in sync with auth.users on signup. full_name and role come
-- from the metadata the sign-up call passes in (see lib/actions/auth.ts).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
create trigger clear_plans_set_updated_at before update on public.clear_plans
  for each row execute function public.set_updated_at();

-- Completed audits are permanent snapshots — block edits once completed_at is set.
create function public.prevent_completed_audit_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' then
    raise exception 'Completed audits are immutable.';
  end if;
  return new;
end;
$$;

create trigger audits_prevent_completed_edit before update on public.audits
  for each row execute function public.prevent_completed_audit_edit();

-- ============================================================================
-- Helper: is this client mine (the calling coach's)?
-- SECURITY DEFINER so it can read profiles without re-triggering RLS on the
-- calling side — this is what keeps the coach-visibility policies below from
-- turning into a recursive mess.
-- ============================================================================
create function public.is_my_client(target_client_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = target_client_id and coach_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.life_areas enable row level security;
alter table public.audits enable row level security;
alter table public.audit_responses enable row level security;
alter table public.clear_plans enable row level security;
alter table public.goals enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.session_notes enable row level security;

-- profiles: you can see/update your own row; a coach can see (not edit) the
-- profiles of clients assigned to them.
create policy "profiles: read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid());
create policy "profiles: coach reads own clients" on public.profiles for select using (coach_id = auth.uid());

-- life_areas: public read-only content; no client writes.
create policy "life_areas: anyone signed in can read" on public.life_areas for select using (auth.role() = 'authenticated');

-- audits
create policy "audits: client full access to own" on public.audits for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "audits: coach reads own clients'" on public.audits for select
  using (public.is_my_client(client_id));

-- audit_responses (scoped through the parent audit)
create policy "audit_responses: client full access to own" on public.audit_responses for all
  using (exists (select 1 from public.audits a where a.id = audit_id and a.client_id = auth.uid()))
  with check (exists (select 1 from public.audits a where a.id = audit_id and a.client_id = auth.uid()));
create policy "audit_responses: coach reads own clients'" on public.audit_responses for select
  using (exists (select 1 from public.audits a where a.id = audit_id and public.is_my_client(a.client_id)));

-- clear_plans
create policy "clear_plans: client full access to own" on public.clear_plans for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "clear_plans: coach reads own clients'" on public.clear_plans for select
  using (public.is_my_client(client_id));

-- goals
create policy "goals: client full access to own" on public.goals for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "goals: coach reads own clients'" on public.goals for select
  using (public.is_my_client(client_id));

-- weekly_checkins
create policy "weekly_checkins: client full access to own" on public.weekly_checkins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "weekly_checkins: coach reads own clients'" on public.weekly_checkins for select
  using (public.is_my_client(client_id));

-- session_notes — coach-authored and coach-only. Clients cannot read these by
-- design (private coaching notes); revisit if you want clients to see them.
create policy "session_notes: coach full access to own clients'" on public.session_notes for all
  using (public.is_my_client(client_id) and coach_id = auth.uid())
  with check (public.is_my_client(client_id) and coach_id = auth.uid());

-- ============================================================================
-- Seed: the ten life areas, exactly as written in the existing prototype.
-- ============================================================================
insert into public.life_areas (sort_order, name, icon, description, hint) values
  (1,  'Health & Energy',              '♥', 'How well you are looking after your body, including sleep, movement, nutrition, energy, physical health and overall wellbeing.', null),
  (2,  'Mindset & Thinking',           '◎', 'Your beliefs, thought patterns, self-talk and mental habits — how you interpret yourself, your life and what is possible for you.', null),
  (3,  'Confidence & Self-Belief',     '★', 'How you feel about yourself, your ability to move forward, and your right to take up space, be seen and pursue what you want.', null),
  (4,  'Relationships & Connection',   '⬡', 'The quality of your relationships, support network, communication and boundaries across your personal, intimate and professional life.', 'Consider the relationships that matter most right now, not every relationship equally.'),
  (5,  'Career, Work & Business',      '◈', 'How aligned you feel with your work, career direction, business growth, contribution, ambition and progress.', null),
  (6,  'Money & Stability',            '◇', 'Your financial clarity, stability, habits and relationship with money, including income, spending, saving, debt, planning and future security.', null),
  (7,  'Purpose & Direction',          '⊕', 'How connected you feel to your values, vision, meaning, future direction and the person you feel called to become.', null),
  (8,  'Daily Structure & Discipline', '▦', 'How well your routines, habits, planning, focus and follow-through support the life you are trying to build.', null),
  (9,  'Emotional Wellbeing',          '◐', 'How well you understand, process and respond to your emotions, stress, triggers and inner world.', null),
  (10, 'Self-Respect & Identity',      '⬟', 'Your relationship with yourself, your standards, boundaries, choices, self-image and the identity your actions are reinforcing.', null);

-- ===== supabase/migrations/0003_simplify_audit.sql =====
-- 0003_simplify_audit.sql
-- The audit now asks one honest 1–10 score per area (plus optional notes),
-- matching the training video. The separate 1–5 importance score is no
-- longer asked, so it becomes optional. Existing answers keep their
-- importance scores; priority_score is simply null for new answers.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the matching app
-- change — until it runs, saving an answer without an importance score fails.
-- (0002 is reserved for the parked diagnostic-engine draft.)

alter table public.audit_responses alter column importance_score drop not null;

-- Shorter area explanations, written to sit beside the per-area video guide.
update public.life_areas set description = 'Your sleep, movement, nutrition, energy levels and overall wellbeing. How well are you looking after your body?' where name = 'Health & Energy';
update public.life_areas set description = 'Your thought patterns, beliefs and self-talk. Notice how your thinking supports you, and where it holds you back.' where name = 'Mindset & Thinking';
update public.life_areas set description = 'How you feel about yourself and your ability to go after what you want. Think about speaking up, being seen and taking the next step.' where name = 'Confidence & Self-Belief';
update public.life_areas set description = 'Your personal, intimate, family and professional relationships. Consider support, honesty, communication and your boundaries.' where name = 'Relationships & Connection';
update public.life_areas set description = 'Your direction, contribution, ambitions and progress. Think about where your working life is taking you.' where name = 'Career, Work & Business';
update public.life_areas set description = 'Your income, spending, saving, debt and future plans. Consider how clear and stable this area feels.' where name = 'Money & Stability';
update public.life_areas set description = 'What matters to you, what gives your life meaning, and whether your direction reflects your values.' where name = 'Purpose & Direction';
update public.life_areas set description = 'Your routines, planning, focus and follow-through. Think about the space you make for what matters.' where name = 'Daily Structure & Discipline';
update public.life_areas set description = 'How you recognise, name and process what you feel. Be honest about how you respond to stress and difficult emotions.' where name = 'Emotional Wellbeing';
update public.life_areas set description = 'Your standards, boundaries, choices and the promises you keep to yourself. Consider what your everyday actions say about who you are.' where name = 'Self-Respect & Identity';

-- ===== supabase/migrations/0004_starting_point.sql =====
-- 0004_starting_point.sql
-- The snapshot now ends with a "starting point": the area the person chooses
-- to work on first (usually their lowest score) and their answer to
-- "What would a [score + 1] look like?". Both are stored on the CLEAR plan
-- for that audit, so CLEAR starts from what they've already said.
--
-- Run in the Supabase SQL Editor before deploying the matching app change.
-- Safe for the live site: adds two optional columns, changes nothing else.

alter table public.clear_plans add column if not exists step_up_target smallint check (step_up_target between 1 and 10);
alter table public.clear_plans add column if not exists step_up_answer text;

-- ===== supabase/migrations/0005_clear_v2.sql =====
-- 0005_clear_v2.sql
-- CLEAR v2: more structured questions. Adds optional fields only; existing
-- plans and goals keep working unchanged.
--
-- clear_plans
--   life_vision      (existing) now "the direction: what would a 10 look like?"
--   step_up_answer   (existing) "the next step: what would a [score+1] look like?"
--   emotional_blocks (existing) now "which block matters most, and why?"
--   blocks           the blocks they tapped (e.g. {"Habit","Knowing where to start"})
--   block_answers    their answer to each block's follow-up, keyed by block
--   tried_before     "when you've tried to change this before, what happened?"
--   if_obstacle / if_response   "If [obstacle], then I'll [response]."
-- goals
--   action_when      when they'll do it, e.g. "Sundays at 6pm"
--
-- Run in the Supabase SQL Editor before deploying the matching app change.

alter table public.clear_plans add column if not exists blocks text[];
alter table public.clear_plans add column if not exists block_answers jsonb;
alter table public.clear_plans add column if not exists tried_before text;
alter table public.clear_plans add column if not exists if_obstacle text;
alter table public.clear_plans add column if not exists if_response text;

alter table public.goals add column if not exists action_when text;

-- ===== supabase/migrations/0006_goal_checkins.sql =====
-- 0006_goal_checkins.sql
-- Monthly check-ins on a CLEAR goal: did they do the action, where the area
-- is now (1–10), what helped / got in the way, and what next.
-- Run in the Supabase SQL Editor before deploying the matching app change.

create table if not exists public.goal_checkins (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  did_it      text not null check (did_it in ('not_yet', 'sometimes', 'most', 'every')),
  area_score  smallint not null check (area_score between 1 and 10),
  helped      text,
  got_in_way  text,
  next_step   text not null check (next_step in ('keep', 'adjust', 'done')),
  created_at  timestamptz not null default now()
);
create index if not exists goal_checkins_goal_id_idx on public.goal_checkins (goal_id);

alter table public.goal_checkins enable row level security;

create policy "goal_checkins: client full access to own" on public.goal_checkins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "goal_checkins: coach reads own clients'" on public.goal_checkins for select
  using (public.is_my_client(client_id));

-- ===== supabase/migrations/0007_service_v1.sql =====
-- 0007_service_v1.sql
-- Service v1: check-in reminders, Academy progress, Tools, coaching enquiries.
-- Run in the Supabase SQL Editor before deploying the matching app change.
-- Adds only; existing data is untouched.

-- Reminders -------------------------------------------------------------------
-- On by default for people with a real account; one email per check-in due date.
alter table public.profiles add column if not exists reminders_email boolean not null default true;
alter table public.profiles add column if not exists email_token uuid not null default gen_random_uuid();

create table if not exists public.reminder_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  kind        text not null default 'checkin' check (kind in ('checkin')),
  due_date    date not null,
  sent_at     timestamptz not null default now(),
  unique (goal_id, kind, due_date)
);
alter table public.reminder_log enable row level security;
-- Written only by the server's daily job (service role); people can see their own.
create policy "reminder_log: client reads own" on public.reminder_log for select using (client_id = auth.uid());

-- Academy ---------------------------------------------------------------------
-- Lesson content lives in the app (lib/learn-content.ts); this keeps each person's
-- progress and private reflection per lesson.
create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  lesson_slug   text not null,
  reflection    text,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (client_id, lesson_slug)
);
alter table public.lesson_progress enable row level security;
create policy "lesson_progress: client full access to own" on public.lesson_progress for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "lesson_progress: coach reads own clients'" on public.lesson_progress for select
  using (public.is_my_client(client_id));

-- Tools -----------------------------------------------------------------------
create table if not exists public.tool_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  tool_slug   text not null,
  answers     jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (client_id, tool_slug)
);
alter table public.tool_entries enable row level security;
create policy "tool_entries: client full access to own" on public.tool_entries for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Coaching enquiries ----------------------------------------------------------
create table if not exists public.coaching_enquiries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  offer         text not null default 'focus_series',
  wants_help    text not null,
  tried         text,
  availability  text,
  status        text not null default 'new' check (status in ('new', 'contacted', 'booked', 'closed')),
  created_at    timestamptz not null default now()
);
alter table public.coaching_enquiries enable row level security;
create policy "coaching_enquiries: client creates and reads own" on public.coaching_enquiries for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coaching_enquiries: coaches read all" on public.coaching_enquiries for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
create policy "coaching_enquiries: coaches update status" on public.coaching_enquiries for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));

-- ===== supabase/migrations/0008_profile_plan_v2.sql =====
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

-- ===== supabase/migrations/0009_lesson_sharing.sql =====
-- 0009_lesson_sharing.sql
-- Lesson reflections are shared with the member's assigned coach by default;
-- the member can mark any reflection "keep private". Private reflections are
-- never readable by a coach.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app change
-- (the app reads and writes the new column).

alter table public.lesson_progress add column if not exists private boolean not null default false;

drop policy if exists "lesson_progress: coach reads own clients'" on public.lesson_progress;
drop policy if exists "lesson_progress: coach reads shared from own clients" on public.lesson_progress;
create policy "lesson_progress: coach reads shared from own clients" on public.lesson_progress for select
  using (public.is_my_client(client_id) and private = false);

-- ===== supabase/migrations/0010_signup_role_and_main_goal.sql =====
-- 0010_signup_role_and_main_goal.sql
-- Run in the Supabase SQL Editor BEFORE deploying the matching app change
-- (the app calls set_main_goal).

-- 1. Security: every new sign-up is a client. Previously the role came from
-- the sign-up metadata, which the person signing up controls, so anyone
-- could create a coach or admin account. Coaches and admins are made by
-- changing the role in the SQL Editor (or Table Editor), never at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'client'
  );
  return new;
end;
$$;

-- 2. Choosing the main goal in one step. A function runs as a single
-- transaction, so the chosen goal becoming 'primary' and the others becoming
-- 'supporting' either both happen or neither does. Runs with the member's
-- own permissions (security invoker), so it only touches their own goals.
create or replace function public.set_main_goal(p_goal_id uuid)
returns boolean
language plpgsql
security invoker set search_path = public
as $$
declare
  chosen int;
begin
  update public.goals
     set goal_type = 'primary'
   where id = p_goal_id and client_id = auth.uid() and status = 'active';
  get diagnostics chosen = row_count;
  if chosen = 0 then
    return false;
  end if;
  update public.goals
     set goal_type = 'supporting'
   where client_id = auth.uid() and status = 'active' and id <> p_goal_id;
  return true;
end;
$$;

revoke all on function public.set_main_goal(uuid) from public;
grant execute on function public.set_main_goal(uuid) to authenticated;

-- ===== supabase/migrations/0011_admin_console.sql =====
-- 0011_admin_console.sql
-- The admin console (/coach, signed in with an admin account).
-- Run in the Supabase SQL Editor BEFORE deploying the matching app change.
--
-- Admins can see every client's work through the same rules coaches use for
-- their own clients. Private things stay private: tool answers and lesson
-- reflections marked private are never readable by a coach or admin (the
-- console only shows lesson COUNTS for those, via admin_client_list).
-- Changing someone's role or coach goes through admin-only functions.
--
-- After running this, make your own account an admin (once), e.g.:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Who is an admin ----------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- "My client" now includes every client for an admin. Every existing coach
-- read policy (audits, answers, plans, goals, check-ins, session notes,
-- shared lesson reflections) uses this, so admins get the same view.
create or replace function public.is_my_client(target_client_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.profiles where id = target_client_id and coach_id = auth.uid()
  );
$$;

drop policy if exists "profiles: admin reads all" on public.profiles;
create policy "profiles: admin reads all" on public.profiles for select using (public.is_admin());

drop policy if exists "reminder_log: admin reads all" on public.reminder_log;
create policy "reminder_log: admin reads all" on public.reminder_log for select using (public.is_admin());

-- Profile guard (from 0008): admins may change role and coach, but only
-- through the functions below (they check is_admin themselves).
create or replace function public.profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_admin() and (
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

-- Admin actions ------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this'; end if;
  if p_role not in ('client', 'coach', 'admin') then raise exception 'Unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You can''t remove your own admin access';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'No such account'; end if;
end;
$$;

create or replace function public.admin_assign_coach(p_client uuid, p_coach uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this'; end if;
  if p_coach is not null and p_coach = p_client then raise exception 'Someone can''t be their own coach'; end if;
  if p_coach is not null and not exists (
    select 1 from public.profiles where id = p_coach and role in ('coach', 'admin')
  ) then
    raise exception 'That person isn''t a coach';
  end if;
  update public.profiles set coach_id = p_coach where id = p_client;
  if not found then raise exception 'No such account'; end if;
end;
$$;

-- The numbers --------------------------------------------------------------
-- Counts only, across every client. Guests = people who started the audit
-- without an account (no email yet).
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can see this'; end if;

  with clients as (
    select id, email, created_at from public.profiles where role = 'client'
  ),
  members as (
    select * from clients where email is not null
  ),
  activity as (
    select client_id, completed_at::date as d from public.audits where status = 'completed' and completed_at is not null
    union select client_id, created_at::date from public.goals
    union select client_id, created_at::date from public.goal_checkins
    union select client_id, updated_at::date from public.lesson_progress
    union select client_id, updated_at::date from public.tool_entries
  ),
  member_activity as (
    select a.client_id, a.d from activity a join members m on m.id = a.client_id
  )
  select jsonb_build_object(
    'members', (select count(*) from members),
    'members_30d', (select count(*) from members where created_at > now() - interval '30 days'),
    'guests', (select count(*) from clients where email is null),
    'audits', (select count(*) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'audits_30d', (select count(*) from public.audits a join clients c on c.id = a.client_id
                    where a.status = 'completed' and a.completed_at > now() - interval '30 days'),
    'people_audited', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'members_audited', (select count(distinct a.client_id) from public.audits a join members m on m.id = a.client_id where a.status = 'completed'),
    'plans_set', (select count(distinct g.client_id) from public.goals g join members m on m.id = g.client_id
                   where coalesce(trim(g.frequency), '') <> '' and coalesce(trim(g.success_criteria), '') <> ''),
    'first_action', (select count(distinct gc.client_id) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.did_it <> 'not_yet'),
    'checkins', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id),
    'checkins_30d', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.created_at > now() - interval '30 days'),
    'goals_done', (select count(*) from public.goals g join members m on m.id = g.client_id where g.status = 'completed'),
    'lessons_done', (select count(*) from public.lesson_progress lp join members m on m.id = lp.client_id where lp.completed_at is not null),
    'people_learning', (select count(distinct lp.client_id) from public.lesson_progress lp join members m on m.id = lp.client_id
                         where lp.completed_at is not null),
    'came_back', (select count(*) from (select client_id from member_activity group by client_id having count(distinct d) >= 2) x),
    'active_30d', (select count(distinct client_id) from member_activity where d > current_date - 30),
    'enquiries', (select count(*) from public.coaching_enquiries),
    'enquiries_new', (select count(*) from public.coaching_enquiries where status = 'new'),
    'enquiries_booked', (select count(*) from public.coaching_enquiries where status = 'booked')
  ) into result;
  return result;
end;
$$;

-- The client list: one row per client with their progress. Admins see every
-- client; a coach sees only their own.
create or replace function public.admin_client_list()
returns table (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  coach_id uuid,
  coach_name text,
  audits int,
  last_audit_at timestamptz,
  last_audit_score int,
  main_goal text,
  main_goal_area text,
  plan_set boolean,
  active_goals int,
  goals_done int,
  checkins int,
  last_checkin_at timestamptz,
  lessons_done int,
  last_active_at timestamptz,
  enquiry_status text
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.created_at, p.coach_id, c.full_name,
    (select count(*)::int from public.audits a where a.client_id = p.id and a.status = 'completed'),
    la.completed_at, la.total_score,
    mg.goal_title, mg.focus_area,
    (mg.id is not null and coalesce(trim(mg.frequency), '') <> '' and coalesce(trim(mg.success_criteria), '') <> ''),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'active'),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'completed'),
    (select count(*)::int from public.goal_checkins gc where gc.client_id = p.id),
    (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
    (select count(*)::int from public.lesson_progress lp where lp.client_id = p.id and lp.completed_at is not null),
    greatest(
      p.created_at,
      la.completed_at,
      (select max(g.created_at) from public.goals g where g.client_id = p.id),
      (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
      (select max(lp.updated_at) from public.lesson_progress lp where lp.client_id = p.id)
    ),
    (select e.status from public.coaching_enquiries e where e.client_id = p.id order by e.created_at desc limit 1)
  from public.profiles p
  left join public.profiles c on c.id = p.coach_id
  left join lateral (
    select a.completed_at, a.total_score from public.audits a
    where a.client_id = p.id and a.status = 'completed'
    order by a.completed_at desc limit 1
  ) la on true
  left join lateral (
    select g.id, g.goal_title, g.focus_area, g.frequency, g.success_criteria from public.goals g
    where g.client_id = p.id and g.status = 'active'
    order by (g.goal_type = 'primary') desc, g.created_at desc limit 1
  ) mg on true
  where p.role = 'client' and (public.is_admin() or p.coach_id = auth.uid())
  order by 18 desc nulls last;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_assign_coach(uuid, uuid) from public, anon;
revoke all on function public.admin_metrics() from public, anon;
revoke all on function public.admin_client_list() from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_assign_coach(uuid, uuid) to authenticated;
grant execute on function public.admin_metrics() to authenticated;
grant execute on function public.admin_client_list() to authenticated;

-- ===== supabase/migrations/0012_guest_tracking.sql =====
-- 0012_guest_tracking.sql
-- Honest guest numbers. From this release a guest sign-in is only created
-- when someone presses "Begin my audit", so the audit welcome page is shown
-- to people with no sign-in at all; it needs the ten area names.
-- The console now counts guests who actually started (answered at least one
-- question) and finished, and leaves empty guest sign-ins out of the list.
-- Run in the SQL Editor (test project first, then live) BEFORE deploying.

-- The ten area names and descriptions are public content.
drop policy if exists "life_areas: anyone can read" on public.life_areas;
create policy "life_areas: anyone can read" on public.life_areas for select using (true);

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can see this'; end if;

  with clients as (
    select id, email, created_at from public.profiles where role = 'client'
  ),
  members as (
    select * from clients where email is not null
  ),
  activity as (
    select client_id, completed_at::date as d from public.audits where status = 'completed' and completed_at is not null
    union select client_id, created_at::date from public.goals
    union select client_id, created_at::date from public.goal_checkins
    union select client_id, updated_at::date from public.lesson_progress
    union select client_id, updated_at::date from public.tool_entries
  ),
  member_activity as (
    select a.client_id, a.d from activity a join members m on m.id = a.client_id
  )
  select jsonb_build_object(
    'members', (select count(*) from members),
    'members_30d', (select count(*) from members where created_at > now() - interval '30 days'),
    -- Guests: people who pressed Begin without an account and answered at
    -- least one question. Empty guest sign-ins (link previews, crawlers,
    -- people who only looked) are not counted.
    'guests', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id
                where c.email is null and exists (select 1 from public.audit_responses r where r.audit_id = a.id)),
    'guests_finished', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id
                         where c.email is null and a.status = 'completed'),
    'guest_signins_empty', (select count(*) from clients c where c.email is null
                             and not exists (select 1 from public.audits a where a.client_id = c.id)),
    'audits', (select count(*) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'audits_30d', (select count(*) from public.audits a join clients c on c.id = a.client_id
                    where a.status = 'completed' and a.completed_at > now() - interval '30 days'),
    'people_audited', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'members_audited', (select count(distinct a.client_id) from public.audits a join members m on m.id = a.client_id where a.status = 'completed'),
    'plans_set', (select count(distinct g.client_id) from public.goals g join members m on m.id = g.client_id
                   where coalesce(trim(g.frequency), '') <> '' and coalesce(trim(g.success_criteria), '') <> ''),
    'first_action', (select count(distinct gc.client_id) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.did_it <> 'not_yet'),
    'checkins', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id),
    'checkins_30d', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.created_at > now() - interval '30 days'),
    'goals_done', (select count(*) from public.goals g join members m on m.id = g.client_id where g.status = 'completed'),
    'lessons_done', (select count(*) from public.lesson_progress lp join members m on m.id = lp.client_id where lp.completed_at is not null),
    'people_learning', (select count(distinct lp.client_id) from public.lesson_progress lp join members m on m.id = lp.client_id
                         where lp.completed_at is not null),
    'came_back', (select count(*) from (select client_id from member_activity group by client_id having count(distinct d) >= 2) x),
    'active_30d', (select count(distinct client_id) from member_activity where d > current_date - 30),
    'enquiries', (select count(*) from public.coaching_enquiries),
    'enquiries_new', (select count(*) from public.coaching_enquiries where status = 'new'),
    'enquiries_booked', (select count(*) from public.coaching_enquiries where status = 'booked')
  ) into result;
  return result;
end;
$$;


create or replace function public.admin_client_list()
returns table (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  coach_id uuid,
  coach_name text,
  audits int,
  last_audit_at timestamptz,
  last_audit_score int,
  main_goal text,
  main_goal_area text,
  plan_set boolean,
  active_goals int,
  goals_done int,
  checkins int,
  last_checkin_at timestamptz,
  lessons_done int,
  last_active_at timestamptz,
  enquiry_status text
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.created_at, p.coach_id, c.full_name,
    (select count(*)::int from public.audits a where a.client_id = p.id and a.status = 'completed'),
    la.completed_at, la.total_score,
    mg.goal_title, mg.focus_area,
    (mg.id is not null and coalesce(trim(mg.frequency), '') <> '' and coalesce(trim(mg.success_criteria), '') <> ''),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'active'),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'completed'),
    (select count(*)::int from public.goal_checkins gc where gc.client_id = p.id),
    (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
    (select count(*)::int from public.lesson_progress lp where lp.client_id = p.id and lp.completed_at is not null),
    greatest(
      p.created_at,
      la.completed_at,
      (select max(g.created_at) from public.goals g where g.client_id = p.id),
      (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
      (select max(lp.updated_at) from public.lesson_progress lp where lp.client_id = p.id)
    ),
    (select e.status from public.coaching_enquiries e where e.client_id = p.id order by e.created_at desc limit 1)
  from public.profiles p
  left join public.profiles c on c.id = p.coach_id
  left join lateral (
    select a.completed_at, a.total_score from public.audits a
    where a.client_id = p.id and a.status = 'completed'
    order by a.completed_at desc limit 1
  ) la on true
  left join lateral (
    select g.id, g.goal_title, g.focus_area, g.frequency, g.success_criteria from public.goals g
    where g.client_id = p.id and g.status = 'active'
    order by (g.goal_type = 'primary') desc, g.created_at desc limit 1
  ) mg on true
  where p.role = 'client' and (public.is_admin() or p.coach_id = auth.uid())
    -- leave out empty guest sign-ins: no account and no audit started
    and (p.email is not null or exists (select 1 from public.audits a where a.client_id = p.id))
  order by 18 desc nulls last;
$$;

