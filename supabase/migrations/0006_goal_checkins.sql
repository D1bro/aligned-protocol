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
