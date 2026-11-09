-- 0028_chart_calibration.sql
-- "Take your chart further" (Duane, 9 Nov 2026): after a client completes the
-- Aligned Protocol alone, a coaching session goes through all ten areas
-- together. For each area: the score they gave alone, what the scores mean
-- for them (in their words), the agreed score, and whether it's a focus area.
-- The agreed scores become the new baseline; the audit itself is never
-- changed, so the score given alone stays as history.
--
-- chart_calibrations  one per session. `areas` is a list of
--                     {life_area_id, alone, agreed, definition, focus}.
--                     The client's coach and admins write it; the client
--                     reads it only once it's shared (like a summary).
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.chart_calibrations (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  audit_id    uuid not null references public.audits(id) on delete cascade,
  session_id  uuid not null unique references public.coaching_sessions(id) on delete cascade,
  coach_id    uuid references public.profiles(id) on delete set null,
  areas       jsonb not null default '[]' check (jsonb_typeof(areas) = 'array' and jsonb_array_length(areas) <= 12),
  status      text not null default 'draft' check (status in ('draft', 'shared')),
  shared_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists chart_calibrations_client_idx on public.chart_calibrations (client_id, created_at desc);
alter table public.chart_calibrations enable row level security;
revoke all on public.chart_calibrations from public, anon;
grant select, insert, update, delete on public.chart_calibrations to authenticated;
drop policy if exists "chart_calibrations: the client's coach and admins" on public.chart_calibrations;
create policy "chart_calibrations: the client's coach and admins" on public.chart_calibrations for all to authenticated
  using (public.is_my_client(client_id))
  with check (
    public.is_my_client(client_id)
    and exists (select 1 from public.audits a where a.id = audit_id and a.client_id = chart_calibrations.client_id)
    and exists (select 1 from public.coaching_sessions s where s.id = session_id and s.client_id = chart_calibrations.client_id)
  );
drop policy if exists "chart_calibrations: client reads shared" on public.chart_calibrations;
create policy "chart_calibrations: client reads shared" on public.chart_calibrations for select to authenticated
  using (client_id = auth.uid() and status = 'shared');
drop trigger if exists chart_calibrations_updated_at on public.chart_calibrations;
create trigger chart_calibrations_updated_at before update on public.chart_calibrations for each row execute function public.set_updated_at();
