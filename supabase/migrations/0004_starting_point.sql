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
