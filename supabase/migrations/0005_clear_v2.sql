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
