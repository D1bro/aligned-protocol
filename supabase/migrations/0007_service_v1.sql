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
-- Lesson content lives in the app (lib/academy.ts); this keeps each person's
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
