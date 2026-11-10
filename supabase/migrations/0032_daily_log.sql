-- The daily log and the Next Step review (Duane, 10 Nov 2026), after
-- reviewing a member's first real use of The Next Step.
--
-- plan_actions.move_id  one tick per move per day (source 'move'). Today on
--                       My Space shows every move due that day, each with its
--                       own tick; the ticks are the daily log, the week's dots
--                       and the coach's "Since last time". A move that's
--                       edited away keeps its ticks (move_id goes null).
-- goals.count_target,   "Done when", counted: the number of ticks of one
-- goals.count_move_id   move that means the step is taken (8 gym sessions),
--                       so the member and their coach both see "3 of 8".
-- next_step_reviews     the coach's Next Step review: the sharper version
--                       agreed in a session (why, the step, done when, how
--                       far, the moves). Written by the coach, sent to the
--                       member, who keeps it or not. The member owns the
--                       words: nothing changes on their Next Step until they
--                       keep it, and they apply it themselves.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

-- 1. A tick per move per day.
alter table public.plan_actions add column if not exists move_id uuid references public.goal_moves(id) on delete set null;
alter table public.plan_actions drop constraint if exists plan_actions_source_check;
alter table public.plan_actions add constraint plan_actions_source_check check (source in ('plan', 'own', 'move'));
create unique index if not exists plan_actions_one_move_tick on public.plan_actions (move_id, action_date) where source = 'move';
create index if not exists plan_actions_move_idx on public.plan_actions (move_id);

-- A tick can only be for one of the member's own moves.
create or replace function public.check_plan_action_move_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.move_id is not null and not exists (
    select 1 from public.goal_moves m where m.id = new.move_id and m.client_id = new.client_id
  ) then
    raise exception 'That move belongs to someone else.';
  end if;
  return new;
end;
$$;
drop trigger if exists plan_actions_move_owner on public.plan_actions;
create trigger plan_actions_move_owner before insert or update of move_id, client_id on public.plan_actions
  for each row execute function public.check_plan_action_move_owner();

-- 2. "Done when", counted.
alter table public.goals add column if not exists count_target smallint;
alter table public.goals add column if not exists count_move_id uuid references public.goal_moves(id) on delete set null;
alter table public.goals drop constraint if exists goals_count_target_check;
alter table public.goals add constraint goals_count_target_check check (count_target is null or count_target between 1 and 365);

-- 3. The coach's Next Step review.
create table if not exists public.next_step_reviews (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals(id) on delete cascade,
  client_id    uuid not null references public.profiles(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  content      jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  sent_at      timestamptz,
  answer       text check (answer in ('kept', 'not_now')),
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists next_step_reviews_goal_idx on public.next_step_reviews (goal_id, created_at desc);
-- One review in hand per Next Step: a draft, or one sent and not yet answered.
create unique index if not exists next_step_reviews_one_open on public.next_step_reviews (goal_id) where answered_at is null;

drop trigger if exists next_step_reviews_set_updated_at on public.next_step_reviews;
create trigger next_step_reviews_set_updated_at before update on public.next_step_reviews
  for each row execute function public.set_updated_at();

-- The goal must be the client's own.
create or replace function public.check_next_step_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.goals g where g.id = new.goal_id and g.client_id = new.client_id) then
    raise exception 'That Next Step belongs to someone else.';
  end if;
  -- The member may only answer: the coach's words and when they were sent stay as written.
  if tg_op = 'UPDATE' and new.client_id = auth.uid() and not public.is_my_client(new.client_id) then
    if new.content is distinct from old.content or new.sent_at is distinct from old.sent_at
       or new.author_id is distinct from old.author_id or new.goal_id is distinct from old.goal_id then
      raise exception 'Only your coach can change their suggestions.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists next_step_reviews_check on public.next_step_reviews;
create trigger next_step_reviews_check before insert or update on public.next_step_reviews
  for each row execute function public.check_next_step_review();

alter table public.next_step_reviews enable row level security;
drop policy if exists "next_step_reviews: staff" on public.next_step_reviews;
create policy "next_step_reviews: staff" on public.next_step_reviews for all to authenticated
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
drop policy if exists "next_step_reviews: member reads sent" on public.next_step_reviews;
create policy "next_step_reviews: member reads sent" on public.next_step_reviews for select to authenticated
  using (client_id = auth.uid() and sent_at is not null);
drop policy if exists "next_step_reviews: member answers" on public.next_step_reviews;
create policy "next_step_reviews: member answers" on public.next_step_reviews for update to authenticated
  using (client_id = auth.uid() and sent_at is not null)
  with check (client_id = auth.uid() and sent_at is not null);
