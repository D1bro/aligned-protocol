-- 0034_daily_alignment.sql
-- The Daily Alignment (Duane's build brief v1, 11 Nov 2026): an add-on to
-- My Space, free in Aligned Clarity. Everyday actions linked to an Alignment
-- area (and, if they choose, a Next Step), each measured one way; a log of
-- what happened; a mindful-minutes timer; and a 1–5 daily check-in whose
-- words go into the journal. New tables only: Next Step moves, their ticks
-- and the journal's existing entries are untouched.
--
-- daily_actions      what they mean to do: done / count / minutes / run
-- daily_action_logs  what happened, one row per entry (manual, timer, review)
-- mindful_timers     the one running timer per person, held by its times so
--                    it survives a refresh, a closed tab or a sleeping phone
-- daily_checkins     one per day: how aligned (1–5), and its journal entry
--
-- Private by default: a coach reads an action and its logs only once the
-- member turns its privacy off. Check-ins and the journal stay private.

create table if not exists public.daily_actions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  measure      text not null check (measure in ('done', 'count', 'minutes', 'run')),
  -- done: times per period · count: amount per period · minutes: minutes per period
  target       integer check (target between 1 and 100000),
  period       text not null default 'week' check (period in ('day', 'week', 'month')),
  unit         text check (length(unit) <= 30),
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_id      uuid references public.goals(id) on delete set null,
  -- Weekdays it's planned for, 0 = Monday … 6 = Sunday; empty = any day.
  days         smallint[] not null default '{}' check (days <@ array[0,1,2,3,4,5,6]::smallint[]),
  at_time      time,
  start_date   date not null default current_date,
  end_date     date,
  mindful      boolean not null default false,
  private      boolean not null default true,
  status       text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  -- A current run (alcohol-free days, retention): when it started, and
  -- when it was paused or ended. Never "failed".
  run_started  date,
  run_paused   date,
  run_ended    date,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists daily_actions_client_idx on public.daily_actions (client_id, status, position);

create table if not exists public.daily_action_logs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  action_id  uuid not null references public.daily_actions(id) on delete cascade,
  log_date   date not null,
  -- A "done" action's tick for the day (one per day), or a count or some
  -- minutes. Each timer session is its own row, so nothing counts twice.
  tick       boolean not null default false,
  amount     integer not null default 0 check (amount between 0 and 100000),
  seconds    integer not null default 0 check (seconds between 0 and 86400),
  source     text not null default 'manual' check (source in ('manual', 'timer', 'review')),
  note       text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists daily_action_logs_client_idx on public.daily_action_logs (client_id, log_date);
create unique index if not exists daily_action_logs_one_tick on public.daily_action_logs (action_id, log_date) where tick;
create unique index if not exists daily_action_logs_one_count on public.daily_action_logs (action_id, log_date) where amount > 0 and source = 'manual';

create table if not exists public.mindful_timers (
  client_id       uuid primary key references public.profiles(id) on delete cascade,
  action_id       uuid references public.daily_actions(id) on delete set null,
  planned_seconds integer not null check (planned_seconds between 60 and 10800),
  started_at      timestamptz not null default now(),
  paused_at       timestamptz,
  paused_seconds  integer not null default 0 check (paused_seconds >= 0),
  intention       text check (length(intention) <= 200),
  created_at      timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  checkin_date     date not null,
  rating           smallint not null check (rating between 1 and 5),
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_id, checkin_date)
);

-- The journal: an entry can be about one daily action (a note after a
-- timer session, a reflection on the gym).
alter table public.journal_entries add column if not exists action_id uuid references public.daily_actions(id) on delete set null;

-- Their own goal, their own action: no linking to someone else's.
create or replace function public.daily_owner_check()
returns trigger language plpgsql set search_path = public
as $$
begin
  -- One branch per table: each reads only the columns its table has.
  if tg_table_name = 'daily_actions' then
    if new.goal_id is not null and not exists (select 1 from public.goals g where g.id = new.goal_id and g.client_id = new.client_id) then
      raise exception 'Choose one of your own Next Steps' using errcode = '23514';
    end if;
  elsif tg_table_name in ('daily_action_logs', 'mindful_timers') then
    if new.action_id is not null and not exists (select 1 from public.daily_actions a where a.id = new.action_id and a.client_id = new.client_id) then
      raise exception 'Choose one of your own actions' using errcode = '23514';
    end if;
  elsif tg_table_name = 'daily_checkins' then
    if new.journal_entry_id is not null and not exists (select 1 from public.journal_entries j where j.id = new.journal_entry_id and j.client_id = new.client_id) then
      raise exception 'Choose one of your own journal entries' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.daily_owner_check() from public, anon, service_role;
drop trigger if exists daily_actions_owner on public.daily_actions;
create trigger daily_actions_owner before insert or update on public.daily_actions for each row execute function public.daily_owner_check();
drop trigger if exists daily_action_logs_owner on public.daily_action_logs;
create trigger daily_action_logs_owner before insert or update on public.daily_action_logs for each row execute function public.daily_owner_check();
drop trigger if exists mindful_timers_owner on public.mindful_timers;
create trigger mindful_timers_owner before insert or update on public.mindful_timers for each row execute function public.daily_owner_check();
drop trigger if exists daily_checkins_owner on public.daily_checkins;
create trigger daily_checkins_owner before insert or update on public.daily_checkins for each row execute function public.daily_owner_check();

drop trigger if exists daily_actions_updated_at on public.daily_actions;
create trigger daily_actions_updated_at before update on public.daily_actions for each row execute function public.set_updated_at();
drop trigger if exists daily_action_logs_updated_at on public.daily_action_logs;
create trigger daily_action_logs_updated_at before update on public.daily_action_logs for each row execute function public.set_updated_at();
drop trigger if exists daily_checkins_updated_at on public.daily_checkins;
create trigger daily_checkins_updated_at before update on public.daily_checkins for each row execute function public.set_updated_at();

-- Who sees what. Members: their own (signed-in members, not guests).
-- Coaches: an action and its logs only when the member has made it not
-- private. Timers and check-ins: the member alone.
alter table public.daily_actions enable row level security;
alter table public.daily_action_logs enable row level security;
alter table public.mindful_timers enable row level security;
alter table public.daily_checkins enable row level security;
revoke all on public.daily_actions, public.daily_action_logs, public.mindful_timers, public.daily_checkins from public, anon, service_role;
grant select, insert, update, delete on public.daily_actions, public.daily_action_logs, public.mindful_timers, public.daily_checkins to authenticated;

drop policy if exists "daily_actions: member owns" on public.daily_actions;
create policy "daily_actions: member owns" on public.daily_actions for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());
drop policy if exists "daily_actions: coach reads shared" on public.daily_actions;
create policy "daily_actions: coach reads shared" on public.daily_actions for select to authenticated
  using (not private and public.is_my_client(client_id));

drop policy if exists "daily_action_logs: member owns" on public.daily_action_logs;
create policy "daily_action_logs: member owns" on public.daily_action_logs for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());
drop policy if exists "daily_action_logs: coach reads shared" on public.daily_action_logs;
create policy "daily_action_logs: coach reads shared" on public.daily_action_logs for select to authenticated
  using (public.is_my_client(client_id) and exists (select 1 from public.daily_actions a where a.id = action_id and not a.private));

drop policy if exists "mindful_timers: member owns" on public.mindful_timers;
create policy "mindful_timers: member owns" on public.mindful_timers for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());

drop policy if exists "daily_checkins: member owns" on public.daily_checkins;
create policy "daily_checkins: member owns" on public.daily_checkins for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());

-- The timer, run by the database's own clock so the phone's clock and a
-- sleeping tab don't matter. Elapsed time = since it started, less any time
-- paused; it stops counting at the planned length.
create or replace function public.mindful_timer_pause()
returns void language sql security invoker set search_path = public
as $$
  update public.mindful_timers set paused_at = now() where client_id = auth.uid() and paused_at is null;
$$;
create or replace function public.mindful_timer_resume()
returns void language sql security invoker set search_path = public
as $$
  update public.mindful_timers
     set paused_seconds = paused_seconds + greatest(0, floor(extract(epoch from now() - paused_at)))::int, paused_at = null
   where client_id = auth.uid() and paused_at is not null;
$$;
-- Finish and log: one log of the actual time (never the planned time when
-- they stop early), and the timer is gone, in one step, so a double tap
-- can't log it twice. Returns the log's id and seconds (none if no timer).
create or replace function public.mindful_timer_finish(p_date date, p_note text default null)
returns table (log_id uuid, logged_seconds integer)
language plpgsql security invoker set search_path = public
as $$
declare
  t public.mindful_timers;
  secs integer;
  new_id uuid;
begin
  delete from public.mindful_timers where client_id = auth.uid() returning * into t;
  if t.client_id is null then return; end if;
  secs := least(t.planned_seconds,
                greatest(0, floor(extract(epoch from coalesce(t.paused_at, now()) - t.started_at))::int - t.paused_seconds));
  if t.action_id is null or secs < 1 then return; end if;
  insert into public.daily_action_logs (client_id, action_id, log_date, seconds, source, note)
  values (t.client_id, t.action_id, p_date, secs, 'timer', nullif(trim(p_note), ''))
  returning id into new_id;
  log_id := new_id;
  logged_seconds := secs;
  return next;
end;
$$;
revoke all on function public.mindful_timer_pause(), public.mindful_timer_resume(), public.mindful_timer_finish(date, text) from public, anon, service_role;
grant execute on function public.mindful_timer_pause(), public.mindful_timer_resume(), public.mindful_timer_finish(date, text) to authenticated;
