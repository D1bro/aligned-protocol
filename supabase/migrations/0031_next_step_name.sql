-- The Next Step, round two (Duane, 10 Nov 2026).
--
-- step_name: a short name for the Next Step, one you'd say out loud
--   ("The Aligned sells on its own"). The step itself stays in goal_title;
--   the name is what the Next Step page and the set page lead with, so a
--   long step no longer reads as a wall of text. Optional.
-- shared_with_coach_at: when the member last sent their Next Step to their
--   coach from the set page. The coach could already see it; sharing emails
--   them so it's in front of them before the next session.

alter table public.goals add column if not exists step_name text;
alter table public.goals drop constraint if exists goals_step_name_check;
alter table public.goals add constraint goals_step_name_check check (step_name is null or char_length(step_name) <= 80);

alter table public.goals add column if not exists shared_with_coach_at timestamptz;
