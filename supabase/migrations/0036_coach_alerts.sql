-- 0036_coach_alerts.sql
-- Alerts to Duane (24 Nov 2026): a record of every alert email the site
-- tries to send him (a new sign-up, a finished audit, a coaching enquiry,
-- a test from Site health), and whether it went. Until now a failed alert
-- vanished without trace; Site health now shows the last one sent and the
-- last one that failed, with Resend's reason.
--
-- Additive: nothing existing is changed. Written and read only by the
-- server (service role); no one signed in can see it directly.

create table if not exists public.coach_alerts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('signup', 'audit', 'enquiry', 'test')),
  subject    text not null check (length(subject) <= 300),
  client_id  uuid references public.profiles(id) on delete set null,
  ok         boolean not null,
  reason     text check (length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists coach_alerts_created_idx on public.coach_alerts (created_at desc);

alter table public.coach_alerts enable row level security;
-- No policies on purpose: only the service role (which skips RLS) reads or
-- writes it.
revoke all on public.coach_alerts from anon, authenticated;
