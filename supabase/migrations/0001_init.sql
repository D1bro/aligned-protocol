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
