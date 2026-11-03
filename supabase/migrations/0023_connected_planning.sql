-- 0023_connected_planning.sql
-- Phase 3 of the build clarifications (3 Nov 2026): My Plan → Monthly
-- Intention → Weekly Focus → Today's Actions, and suggestions after a new
-- audit that never overwrite a goal. Free for every member; a member's coach
-- can read them, like goals. Nothing existing is changed or removed.
--
-- monthly_intentions  one per member per month: "How do you want to live this
--                     month?" in their words, optionally linked to a goal.
--                     `month` is the first day of the month.
-- plan_actions        today's actions. source 'plan' ticks off the plan's own
--                     action on a day (one per goal per day); 'own' is an
--                     action they add, linked to a goal where it fits.
--                     done_at is when they ticked it.
-- plan_suggestion_dismissals
--                     audits whose "What's changed" suggestions they've
--                     dismissed (completed audits themselves can't be edited).
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.monthly_intentions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  intention   text not null check (length(trim(intention)) between 1 and 300),
  goal_id     uuid references public.goals(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, month)
);
alter table public.monthly_intentions enable row level security;
drop policy if exists "monthly_intentions: client full access to own" on public.monthly_intentions;
create policy "monthly_intentions: client full access to own" on public.monthly_intentions for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.client_id = auth.uid())));
drop policy if exists "monthly_intentions: coach reads own clients'" on public.monthly_intentions;
create policy "monthly_intentions: coach reads own clients'" on public.monthly_intentions for select
  using (public.is_my_client(client_id));

create table if not exists public.plan_actions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  goal_id      uuid references public.goals(id) on delete set null,
  action_date  date not null,
  source       text not null default 'own' check (source in ('plan', 'own')),
  body         text not null check (length(trim(body)) between 1 and 200),
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists plan_actions_client_date_idx on public.plan_actions (client_id, action_date);
create unique index if not exists plan_actions_one_plan_tick on public.plan_actions (client_id, goal_id, action_date) where source = 'plan';
alter table public.plan_actions enable row level security;
drop policy if exists "plan_actions: client full access to own" on public.plan_actions;
create policy "plan_actions: client full access to own" on public.plan_actions for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.client_id = auth.uid())));
drop policy if exists "plan_actions: coach reads own clients'" on public.plan_actions;
create policy "plan_actions: coach reads own clients'" on public.plan_actions for select
  using (public.is_my_client(client_id));

create table if not exists public.plan_suggestion_dismissals (
  client_id     uuid not null references public.profiles(id) on delete cascade,
  audit_id      uuid not null references public.audits(id) on delete cascade,
  dismissed_at  timestamptz not null default now(),
  primary key (client_id, audit_id)
);
alter table public.plan_suggestion_dismissals enable row level security;
drop policy if exists "plan_suggestion_dismissals: client full access to own" on public.plan_suggestion_dismissals;
create policy "plan_suggestion_dismissals: client full access to own" on public.plan_suggestion_dismissals for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (select 1 from public.audits a where a.id = audit_id and a.client_id = auth.uid()));
