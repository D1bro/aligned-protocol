-- 0029_next_step.sql
-- The Next Step (Duane, 10 Nov 2026) replaces My Plan. A Next Step is the one
-- change that gets someone out of where they're stuck in an area of their
-- chart. Each Next Step is a goals row, so everything already linked to goals
-- (coaching steps, check-ins, reminders, My Space, the journal) keeps working.
--
-- goals
--   start_score    the area's score when the Next Step was set (1–10)
--   aim_score      how far they think it could take them, their best guess
--   feel_text      "What will it feel like when you've taken it?"
--   in_the_way     "What's in the way of it?"
--   spill_over     "How is being stuck affecting the rest of your life?"
--   step_checks    the three checks: {"different","reach","visible"} → true/false
--   set_at         when they finished setting it (old plans: when created)
--   taken_score    the area's score once it's taken
--   taken_at       when it was taken
--   what_changed   "What changed?", once it's taken
-- goal_moves       the moves that get them there: once (optionally by a date)
--                  or repeating (on the days in when_text). The member's own,
--                  readable by their coach, like goals.
-- goal_checkins
--   closer         the weekly check-in: 'closer' | 'same' | 'further'
--
-- Existing plans become Next Steps (Duane's decision, 10 Nov): each goal's
-- weekly action becomes its first move, finished plans count as set, and the
-- starting score and the old "what would a [score + 1] look like" aim are
-- copied across. Nothing is deleted or overwritten.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

alter table public.goals add column if not exists start_score smallint;
alter table public.goals add column if not exists aim_score smallint;
alter table public.goals add column if not exists feel_text text;
alter table public.goals add column if not exists in_the_way text;
alter table public.goals add column if not exists spill_over text;
alter table public.goals add column if not exists step_checks jsonb;
alter table public.goals add column if not exists set_at timestamptz;
alter table public.goals add column if not exists taken_score smallint;
alter table public.goals add column if not exists taken_at timestamptz;
alter table public.goals add column if not exists what_changed text;

alter table public.goals drop constraint if exists goals_next_step_scores_check;
alter table public.goals add constraint goals_next_step_scores_check check (
  (start_score is null or start_score between 1 and 10)
  and (aim_score is null or aim_score between 1 and 10)
  and (taken_score is null or taken_score between 1 and 10)
);
alter table public.goals drop constraint if exists goals_step_checks_check;
alter table public.goals add constraint goals_step_checks_check check (step_checks is null or jsonb_typeof(step_checks) = 'object');

create table if not exists public.goal_moves (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  position    smallint not null default 0,
  body        text not null check (length(trim(body)) between 1 and 200),
  when_text   text check (when_text is null or length(when_text) <= 120),
  due_date    date,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists goal_moves_goal_idx on public.goal_moves (goal_id, position);
create index if not exists goal_moves_client_idx on public.goal_moves (client_id);
alter table public.goal_moves enable row level security;
revoke all on public.goal_moves from public, anon;
grant select, insert, update, delete on public.goal_moves to authenticated;
drop policy if exists "goal_moves: client full access to own" on public.goal_moves;
create policy "goal_moves: client full access to own" on public.goal_moves for all to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (select 1 from public.goals g where g.id = goal_id and g.client_id = auth.uid()));
drop policy if exists "goal_moves: coach reads own clients'" on public.goal_moves;
create policy "goal_moves: coach reads own clients'" on public.goal_moves for select to authenticated
  using (public.is_my_client(client_id));

alter table public.goal_checkins add column if not exists closer text;
alter table public.goal_checkins drop constraint if exists goal_checkins_closer_check;
alter table public.goal_checkins add constraint goal_checkins_closer_check check (closer is null or closer in ('closer', 'same', 'further'));
-- The weekly check-in asks "is it closer?" rather than "did you do it?".
alter table public.goal_checkins alter column did_it drop not null;
alter table public.goal_checkins alter column next_step drop not null;

-- Existing plans become Next Steps -------------------------------------------
-- The old weekly action becomes the first move (once per goal).
insert into public.goal_moves (client_id, goal_id, position, body, when_text, created_at)
select g.client_id, g.id, 0, left(trim(g.action_text), 200), nullif(left(trim(coalesce(g.action_when, g.frequency, '')), 120), ''), g.created_at
  from public.goals g
 where length(trim(coalesce(g.action_text, ''))) > 0
   and not exists (select 1 from public.goal_moves m where m.goal_id = g.id);

-- A finished plan counts as a set Next Step.
update public.goals
   set set_at = created_at
 where set_at is null
   and length(trim(coalesce(frequency, ''))) > 0
   and length(trim(coalesce(success_criteria, ''))) > 0;

-- The area's score when the plan was built, and the aim it was built towards.
update public.goals g
   set start_score = coalesce(g.start_score, r.satisfaction_score),
       aim_score = coalesce(g.aim_score, p.step_up_target)
  from public.clear_plans p
  left join public.audit_responses r on r.audit_id = p.audit_id and r.life_area_id = p.life_area_id
 where p.id = g.clear_plan_id
   and (g.start_score is null or g.aim_score is null);
