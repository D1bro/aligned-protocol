-- 0021_plan_journey.sql
-- Build your plan in five guided steps, and the weekly review.
--
-- clear_plans
--   why_it_matters   step 2: "Why does it matter to you?" (asked before the
--                    goal exists; copied to the goal's motivation_text at step 4)
-- goal_checkins
--   kind             'weekly' (the weekly review) or 'monthly' (the monthly
--                    review, the check-in that existed before). Existing rows
--                    are monthly.
--   area_score       only the monthly review asks for it now
--   did_it           weekly answers: 'done' | 'partly' | 'missed'
--   next_step        weekly choices: 'keep' | 'smaller' | 'change'
--   next_commitment  what they're committing to next week, in their words
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

alter table public.clear_plans add column if not exists why_it_matters text;

alter table public.goal_checkins add column if not exists kind text not null default 'monthly';
alter table public.goal_checkins drop constraint if exists goal_checkins_kind_check;
alter table public.goal_checkins add constraint goal_checkins_kind_check check (kind in ('weekly', 'monthly'));

alter table public.goal_checkins alter column area_score drop not null;
alter table public.goal_checkins drop constraint if exists goal_checkins_monthly_score_check;
alter table public.goal_checkins add constraint goal_checkins_monthly_score_check check (kind = 'weekly' or area_score is not null);

alter table public.goal_checkins drop constraint if exists goal_checkins_did_it_check;
alter table public.goal_checkins add constraint goal_checkins_did_it_check
  check (did_it in ('not_yet', 'sometimes', 'most', 'every', 'done', 'partly', 'missed'));

alter table public.goal_checkins drop constraint if exists goal_checkins_next_step_check;
alter table public.goal_checkins add constraint goal_checkins_next_step_check
  check (next_step in ('keep', 'adjust', 'done', 'smaller', 'change'));

alter table public.goal_checkins add column if not exists next_commitment text;

-- A review can only be added to your own goal (before, the goal's owner
-- wasn't checked, only the review's).
drop policy if exists "goal_checkins: client full access to own" on public.goal_checkins;
create policy "goal_checkins: client full access to own" on public.goal_checkins for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (select 1 from public.goals g where g.id = goal_id and g.client_id = auth.uid()));
