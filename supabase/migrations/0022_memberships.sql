-- 0022_memberships.sql
-- Memberships (Aligned Practice and Aligned Momentum, monthly through
-- Stripe), Aligned Focus unlocking a membership for its six weeks, the
-- Momentum session details, and the private journal.
--
-- * memberships: one row per Stripe subscription. Written only by the server
--   (the Stripe webhook and the checkout return), never by members.
-- * packages.includes_membership: a package (Aligned Focus) that unlocks a
--   membership for its "use within" days, from when it's fully paid.
-- * my_membership(): what the signed-in member has right now, from either.
-- * membership_settings: the Momentum session's time, join link and note.
-- * journal_entries: private, like Daily Alignment; nobody else can read them.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.memberships (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.profiles(id) on delete cascade,
  tier                    text not null check (tier in ('practice', 'momentum')),
  status                  text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  stripe_subscription_id  text not null unique,
  stripe_customer_id      text not null,
  price_pence             integer not null check (price_pence > 0),
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  started_at              timestamptz not null default now(),
  ended_at                timestamptz,
  updated_at              timestamptz not null default now()
);
create index if not exists memberships_client_idx on public.memberships (client_id);
alter table public.memberships enable row level security;
drop policy if exists "memberships: member reads own" on public.memberships;
create policy "memberships: member reads own" on public.memberships for select using (client_id = auth.uid());
drop policy if exists "memberships: admin reads all" on public.memberships;
create policy "memberships: admin reads all" on public.memberships for select using (public.is_admin() or public.can_bill());
drop trigger if exists memberships_touch on public.memberships;
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();

alter table public.packages add column if not exists includes_membership text;
alter table public.packages drop constraint if exists packages_includes_membership_check;
alter table public.packages add constraint packages_includes_membership_check check (includes_membership is null or includes_membership in ('practice', 'momentum'));

-- What the signed-in member has now: active subscriptions (a failed payment
-- keeps access while Stripe retries) and paid packages that include a
-- membership, until their "use within" days run out (six weeks if unset).
create or replace function public.my_membership()
returns table (tier text, source text, until timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select m.tier, 'subscription'::text, m.current_period_end
  from public.memberships m
  where m.client_id = auth.uid() and m.status in ('trialing', 'active', 'past_due')
  union all
  select p.includes_membership, 'package'::text, l.created_at + make_interval(days => coalesce(p.valid_days, 42))
  from public.entitlement_ledger l
  join public.invoices i on i.id = l.invoice_id
  join public.packages p on p.id = i.package_id
  where l.client_id = auth.uid() and l.kind = 'grant' and p.includes_membership is not null
    and l.created_at + make_interval(days => coalesce(p.valid_days, 42)) > now();
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

create table if not exists public.membership_settings (
  id                 boolean primary key default true check (id),
  momentum_when      text check (length(momentum_when) <= 200),
  momentum_join_url  text check (momentum_join_url is null or momentum_join_url ~ '^https://'),
  momentum_note      text check (length(momentum_note) <= 1000),
  updated_at         timestamptz not null default now()
);
insert into public.membership_settings (id) values (true) on conflict (id) do nothing;
alter table public.membership_settings enable row level security;
drop policy if exists "membership_settings: admin" on public.membership_settings;
create policy "membership_settings: admin" on public.membership_settings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "membership_settings: momentum members read" on public.membership_settings;
create policy "membership_settings: momentum members read" on public.membership_settings for select
  using (exists (select 1 from public.my_membership() m where m.tier = 'momentum'));
drop trigger if exists membership_settings_touch on public.membership_settings;
create trigger membership_settings_touch before update on public.membership_settings for each row execute function public.touch_updated_at();

create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  entry_date  date not null,
  prompt      text check (length(prompt) <= 300),
  body        text not null check (length(trim(body)) between 1 and 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists journal_entries_client_idx on public.journal_entries (client_id, entry_date desc);
alter table public.journal_entries enable row level security;
revoke all on public.journal_entries from public, anon, service_role;
grant select, insert, update, delete on public.journal_entries to authenticated;
drop policy if exists "journal: member owns private entries" on public.journal_entries;
create policy "journal: member owns private entries" on public.journal_entries for all to authenticated
  using (client_id = auth.uid() and public.alignment_is_member())
  with check (client_id = auth.uid() and public.alignment_is_member());
drop trigger if exists journal_entries_updated_at on public.journal_entries;
create trigger journal_entries_updated_at before update on public.journal_entries for each row execute function public.set_updated_at();
-- Deliberately no coach or admin policy: the journal is private.
