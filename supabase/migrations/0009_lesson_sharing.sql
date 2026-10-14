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
