-- 0035_daily_review.sql
-- The Daily Alignment, release 2 (Duane's build brief v1, 11 Nov 2026):
-- the weekly review, prepared from the week's logs, and choosing exactly
-- what a coach sees. Additive: nothing existing is changed or removed.
--
-- daily_reviews   one per person per week (Monday): what moved, what helped,
--                 what got in the way, is the Next Step closer, keep it /
--                 make it smaller / change it, a snapshot of the evidence it
--                 was prepared from, and the choices made for each action.
--                 Private, like the journal. Its "is it closer?" is also
--                 recorded as the Next Step's weekly check-in (goal_checkins,
--                 the answer only, no words), so there's one weekly rhythm.
-- prep_shares     the member's existing "share with my coach" (preparation
--                 for a session) now also carries one journal entry, one
--                 weekly review or one question for coaching. Sharing copies
--                 the words; the coach never reads the journal itself. Taking
--                 a share back deletes the copy.

create table if not exists public.daily_reviews (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  week_start       date not null check (extract(isodow from week_start) = 1),
  goal_id          uuid references public.goals(id) on delete set null,
  moved            text check (length(moved) <= 2000),
  helped           text check (length(helped) <= 2000),
  in_way           text check (length(in_way) <= 2000),
  closer           text check (closer in ('closer', 'same', 'further')),
  decision         text check (decision in ('keep', 'smaller', 'change')),
  -- What it was prepared from, as it stood when saved: [{name, line, plan}].
  evidence         jsonb not null default '[]'::jsonb,
  -- For each action: [{action_id, name, choice: keep|smaller|pause, target}].
  choices          jsonb not null default '[]'::jsonb,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  checkin_id       uuid references public.goal_checkins(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_id, week_start)
);

-- Their own Next Step, their own journal entry and check-in: one branch per
-- table, as in 0034, with the review's added.
create or replace function public.daily_owner_check()
returns trigger language plpgsql set search_path = public
as $$
begin
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
  elsif tg_table_name = 'daily_reviews' then
    if new.goal_id is not null and not exists (select 1 from public.goals g where g.id = new.goal_id and g.client_id = new.client_id) then
      raise exception 'Choose one of your own Next Steps' using errcode = '23514';
    end if;
    if new.journal_entry_id is not null and not exists (select 1 from public.journal_entries j where j.id = new.journal_entry_id and j.client_id = new.client_id) then
      raise exception 'Choose one of your own journal entries' using errcode = '23514';
    end if;
    if new.checkin_id is not null and not exists (select 1 from public.goal_checkins c where c.id = new.checkin_id and c.client_id = new.client_id) then
      raise exception 'Choose one of your own check-ins' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.daily_owner_check() from public, anon, service_role;
drop trigger if exists daily_reviews_owner on public.daily_reviews;
create trigger daily_reviews_owner before insert or update on public.daily_reviews for each row execute function public.daily_owner_check();
drop trigger if exists daily_reviews_updated_at on public.daily_reviews;
create trigger daily_reviews_updated_at before update on public.daily_reviews for each row execute function public.set_updated_at();

alter table public.daily_reviews enable row level security;
revoke all on public.daily_reviews from public, anon, service_role;
grant select, insert, update, delete on public.daily_reviews to authenticated;
drop policy if exists "daily_reviews: member owns" on public.daily_reviews;
create policy "daily_reviews: member owns" on public.daily_reviews for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());

-- Sharing with a coach: what kind of thing was shared, which one (so it can
-- be taken back, and isn't shared twice) and a short title. Existing rows
-- are session preparation.
alter table public.prep_shares add column if not exists kind text not null default 'prep';
alter table public.prep_shares drop constraint if exists prep_shares_kind_check;
alter table public.prep_shares add constraint prep_shares_kind_check check (kind in ('prep', 'entry', 'review', 'question'));
alter table public.prep_shares add column if not exists source_id uuid;
alter table public.prep_shares add column if not exists title text;
alter table public.prep_shares drop constraint if exists prep_shares_title_check;
alter table public.prep_shares add constraint prep_shares_title_check check (title is null or length(title) <= 200);
create unique index if not exists prep_shares_one_source on public.prep_shares (client_id, kind, source_id) where source_id is not null;
