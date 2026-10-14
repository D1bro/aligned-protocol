-- 0014_billing.sql
-- Invoicing for Aligned Media (not VAT registered), payments by bank
-- transfer and payment link, and the session-credit ledger.
-- Run on the TEST project first; live only after review.
--
-- Money is stored in pence (integers). Issued invoices are frozen: totals,
-- supplier, customer and payment details are snapshotted at issue and never
-- rewritten. Corrections use voids or credit notes. Every money or credit
-- change goes through a function below that checks permission and runs as
-- one transaction.
--
-- Balances (documented, and the only place they're defined):
--   invoice paid      = sum of active allocations to it
--   invoice credited  = sum of its credit notes
--   invoice balance   = total - credited - paid            (never below 0)
--   receipt unapplied = amount - active allocations - refunds (never below 0)
-- A refund only comes out of unapplied money, and a credit note only reduces
-- what's still owed, so the two can't double-count.

-- Who may manage billing: an admin explicitly allowed to. Promoting someone
-- to coach (or even admin) doesn't grant it on its own.
alter table public.profiles add column if not exists can_manage_billing boolean not null default false;

create or replace function public.can_bill()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and can_manage_billing);
$$;

-- Members can't change their own billing permission (extends 0008/0011's guard).
create or replace function public.profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_admin() and (
       new.role is distinct from old.role
    or new.coach_id is distinct from old.coach_id
    or new.email_token is distinct from old.email_token
    or new.can_manage_billing is distinct from old.can_manage_billing
    or (old.email is not null and new.email is distinct from old.email)
  ) then
    raise exception 'This profile field can''t be changed here';
  end if;
  -- Only someone who can already bill can grant billing.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and new.can_manage_billing is distinct from old.can_manage_billing
     and not public.can_bill() then
    raise exception 'Only a billing admin can change billing access';
  end if;
  return new;
end;
$$;

-- Business settings (one row) ---------------------------------------------
create table if not exists public.billing_settings (
  id                    integer primary key default 1 check (id = 1),
  trading_name          text not null default 'Aligned Media',
  legal_name            text,
  legal_form            text,
  address               text,
  contact_email         text,
  contact_phone         text,
  vat_status            text not null default 'not_registered' check (vat_status in ('not_registered')),
  currency              text not null default 'GBP' check (currency = 'GBP'),
  invoice_prefix        text not null default 'AM-',
  credit_note_prefix    text not null default 'AM-CN-',
  payment_terms_days    integer not null default 14 check (payment_terms_days between 0 and 120),
  bank_account_name     text,
  bank_sort_code        text,
  bank_account_number   text,
  bank_note             text,
  credit_policy         text not null default 'grant_on_full_payment' check (credit_policy = 'grant_on_full_payment'),
  updated_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now()
);
insert into public.billing_settings (id) values (1) on conflict (id) do nothing;
alter table public.billing_settings enable row level security;
create policy "billing_settings: billing admin" on public.billing_settings for all using (public.can_bill()) with check (public.can_bill());

create table if not exists public.billing_counters (
  kind         text primary key check (kind in ('invoice', 'credit_note')),
  last_number  integer not null default 0
);
insert into public.billing_counters (kind) values ('invoice'), ('credit_note') on conflict (kind) do nothing;
alter table public.billing_counters enable row level security;
create policy "billing_counters: billing admin reads" on public.billing_counters for select using (public.can_bill());

-- Customers ---------------------------------------------------------------
create table if not exists public.billing_customers (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  name        text not null,
  email       text,
  address     text,
  updated_at  timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
create policy "billing_customers: billing admin" on public.billing_customers for all using (public.can_bill()) with check (public.can_bill());
create policy "billing_customers: member reads own" on public.billing_customers for select using (client_id = auth.uid());

-- Invoices ----------------------------------------------------------------
create table if not exists public.invoices (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.profiles(id) on delete restrict,
  status                text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  sequence              integer unique,
  number                text unique,
  issue_date            date,
  due_date              date,
  service_period        text,
  supplier              jsonb,
  customer              jsonb,
  payment_instructions  jsonb,
  tax_treatment         text not null default 'not_registered' check (tax_treatment in ('not_registered')),
  currency              text not null default 'GBP' check (currency = 'GBP'),
  discount_pence        integer not null default 0 check (discount_pence >= 0),
  subtotal_pence        integer not null default 0,
  total_pence           integer not null default 0,
  credits_purchased     integer not null default 0 check (credits_purchased between 0 and 100),
  notes                 text,
  pdf_status            text not null default 'none' check (pdf_status in ('none', 'pending', 'ready', 'failed')),
  pdf_path              text,
  pdf_error             text,
  delivery_status       text not null default 'not_sent' check (delivery_status in ('not_sent', 'queued', 'sent', 'delivered', 'failed')),
  delivery_error        text,
  issued_at             timestamptz,
  issued_by             uuid references public.profiles(id) on delete set null,
  voided_at             timestamptz,
  void_reason           text,
  replaces_invoice_id   uuid references public.invoices(id) on delete set null,
  payment_link_url      text,
  payment_link_at       timestamptz,
  version               integer not null default 1,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (status = 'draft' or (number is not null and sequence is not null and issue_date is not null))
);
create index if not exists invoices_client_idx on public.invoices (client_id);
alter table public.invoices enable row level security;
create policy "invoices: billing admin" on public.invoices for all using (public.can_bill()) with check (public.can_bill());
create policy "invoices: member reads own issued" on public.invoices for select using (client_id = auth.uid() and status <> 'draft');

create table if not exists public.invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  position     integer not null,
  description  text not null check (length(trim(description)) > 0),
  quantity     integer not null default 1 check (quantity between 1 and 1000),
  unit_pence   integer not null check (unit_pence between 0 and 100000000),
  unique (invoice_id, position)
);
alter table public.invoice_items enable row level security;
create policy "invoice_items: billing admin" on public.invoice_items for all using (public.can_bill()) with check (public.can_bill());
create policy "invoice_items: member reads own issued" on public.invoice_items for select using (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.client_id = auth.uid() and i.status <> 'draft')
);

-- Issued invoices and their lines are frozen.
create or replace function public.invoices_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    new.updated_at = now();
    return new;
  end if;
  if new.client_id is distinct from old.client_id or new.number is distinct from old.number or new.sequence is distinct from old.sequence
     or new.issue_date is distinct from old.issue_date or new.due_date is distinct from old.due_date
     or new.supplier is distinct from old.supplier or new.customer is distinct from old.customer
     or new.payment_instructions is distinct from old.payment_instructions or new.tax_treatment is distinct from old.tax_treatment
     or new.discount_pence is distinct from old.discount_pence or new.subtotal_pence is distinct from old.subtotal_pence
     or new.total_pence is distinct from old.total_pence or new.credits_purchased is distinct from old.credits_purchased
     or new.service_period is distinct from old.service_period or new.notes is distinct from old.notes
     or (old.status = 'void' and new.status <> 'void') or (new.status = 'draft') then
    raise exception 'An issued invoice can''t be changed. Void it or issue a credit note instead.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger invoices_guard before update on public.invoices for each row execute function public.invoices_guard();

create or replace function public.invoices_no_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Issued invoices are kept for the record. Void it instead.';
  end if;
  return old;
end;
$$;
create trigger invoices_no_delete before delete on public.invoices for each row execute function public.invoices_no_delete();

create or replace function public.invoice_items_guard()
returns trigger
language plpgsql
as $$
declare
  inv uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if exists (select 1 from public.invoices where id = inv and status <> 'draft') then
    raise exception 'An issued invoice''s lines can''t be changed.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_guard();

-- Receipts, allocations, credit notes, refunds -----------------------------
create table if not exists public.receipts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles(id) on delete restrict,
  source         text not null check (source in ('bank_transfer', 'payment_link')),
  external_id    text,
  amount_pence   integer not null check (amount_pence > 0),
  currency       text not null default 'GBP' check (currency = 'GBP'),
  received_on    date not null,
  reference      text,
  note           text,
  status         text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  reverse_reason text,
  operation_key  text not null unique,
  confirmed_by   uuid references public.profiles(id) on delete set null,
  confirmed_at   timestamptz not null default now()
);
create unique index if not exists receipts_external_unique on public.receipts (source, external_id) where external_id is not null;
alter table public.receipts enable row level security;
create policy "receipts: billing admin" on public.receipts for all using (public.can_bill()) with check (public.can_bill());
create policy "receipts: member reads own" on public.receipts for select using (client_id = auth.uid() and status = 'confirmed');

create table if not exists public.receipt_allocations (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references public.receipts(id) on delete restrict,
  invoice_id    uuid not null references public.invoices(id) on delete restrict,
  amount_pence  integer not null check (amount_pence > 0),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  reversed_at   timestamptz,
  reversed_by   uuid references public.profiles(id) on delete set null,
  reverse_reason text
);
alter table public.receipt_allocations enable row level security;
create policy "receipt_allocations: billing admin" on public.receipt_allocations for all using (public.can_bill()) with check (public.can_bill());
create policy "receipt_allocations: member reads own" on public.receipt_allocations for select using (
  reversed_at is null and exists (select 1 from public.invoices i where i.id = invoice_id and i.client_id = auth.uid() and i.status <> 'draft')
);

create table if not exists public.credit_notes (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid not null references public.invoices(id) on delete restrict,
  client_id          uuid not null references public.profiles(id) on delete restrict,
  sequence           integer not null unique,
  number             text not null unique,
  amount_pence       integer not null check (amount_pence > 0),
  credits_removed    integer not null default 0 check (credits_removed >= 0),
  reason             text not null,
  issued_by          uuid references public.profiles(id) on delete set null,
  issued_at          timestamptz not null default now()
);
alter table public.credit_notes enable row level security;
create policy "credit_notes: billing admin" on public.credit_notes for all using (public.can_bill()) with check (public.can_bill());
create policy "credit_notes: member reads own" on public.credit_notes for select using (client_id = auth.uid());

create table if not exists public.refunds (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references public.receipts(id) on delete restrict,
  client_id     uuid not null references public.profiles(id) on delete restrict,
  amount_pence  integer not null check (amount_pence > 0),
  reason        text not null,
  refunded_on   date not null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.refunds enable row level security;
create policy "refunds: billing admin" on public.refunds for all using (public.can_bill()) with check (public.can_bill());
create policy "refunds: member reads own" on public.refunds for select using (client_id = auth.uid());

-- "I've paid" from a member: a request to check, never proof of payment.
create table if not exists public.payment_notices (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  note        text,
  status      text not null default 'new' check (status in ('new', 'matched', 'not_found')),
  created_at  timestamptz not null default now()
);
alter table public.payment_notices enable row level security;
create policy "payment_notices: member reads own" on public.payment_notices for select using (client_id = auth.uid());
create policy "payment_notices: member adds" on public.payment_notices for insert
  with check (client_id = auth.uid() and exists (select 1 from public.invoices i where i.id = invoice_id and i.client_id = auth.uid() and i.status = 'issued'));
create policy "payment_notices: billing admin" on public.payment_notices for all using (public.can_bill()) with check (public.can_bill());

-- Payment provider events (deduplicated; written by the server only).
create table if not exists public.provider_events (
  id           text primary key,
  provider     text not null,
  type         text not null,
  invoice_id   uuid references public.invoices(id) on delete set null,
  outcome      text,
  received_at  timestamptz not null default now()
);
alter table public.provider_events enable row level security;
create policy "provider_events: billing admin reads" on public.provider_events for select using (public.can_bill());

-- Session credits -----------------------------------------------------------
create table if not exists public.entitlement_ledger (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles(id) on delete restrict,
  kind           text not null check (kind in ('grant', 'use', 'adjust', 'credit_note')),
  quantity       integer not null check (quantity <> 0),
  invoice_id     uuid references public.invoices(id) on delete set null,
  session_id     uuid references public.coaching_sessions(id) on delete set null,
  reason         text,
  operation_key  text not null unique,
  actor_id       uuid,
  created_at     timestamptz not null default now()
);
alter table public.entitlement_ledger enable row level security;
create policy "entitlement_ledger: billing admin" on public.entitlement_ledger for select using (public.can_bill());
create policy "entitlement_ledger: member reads own" on public.entitlement_ledger for select using (client_id = auth.uid());

create table if not exists public.session_reservations (
  session_id  uuid primary key references public.coaching_sessions(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('active', 'consumed', 'released')),
  updated_at  timestamptz not null default now()
);
alter table public.session_reservations enable row level security;
create policy "session_reservations: staff read" on public.session_reservations for select using (public.is_my_client(client_id) or public.can_bill());
create policy "session_reservations: member reads own" on public.session_reservations for select using (client_id = auth.uid());

-- Internal helpers: the maths without permission checks. Only callable from
-- the functions below (execute is revoked from every API role).
create or replace function public._credit_available(p_client uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select (coalesce((select sum(quantity) from public.entitlement_ledger where client_id = p_client), 0)
          - (select count(*) from public.session_reservations where client_id = p_client and status = 'active'))::int;
$$;

create or replace function public._invoice_balance(p_invoice uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select (i.total_pence
          - coalesce((select sum(c.amount_pence) from public.credit_notes c where c.invoice_id = i.id), 0)
          - coalesce((select sum(a.amount_pence) from public.receipt_allocations a where a.invoice_id = i.id and a.reversed_at is null), 0))::int
  from public.invoices i where i.id = p_invoice;
$$;

create or replace function public._receipt_unapplied(p_receipt uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select (r.amount_pence
          - coalesce((select sum(a.amount_pence) from public.receipt_allocations a where a.receipt_id = r.id and a.reversed_at is null), 0)
          - coalesce((select sum(f.amount_pence) from public.refunds f where f.receipt_id = r.id), 0))::int
  from public.receipts r where r.id = p_receipt;
$$;
revoke all on function public._credit_available(uuid) from public, anon, authenticated;
revoke all on function public._invoice_balance(uuid) from public, anon, authenticated;
revoke all on function public._receipt_unapplied(uuid) from public, anon, authenticated;

-- Credit balance: everything granted/used/adjusted, minus credits held by
-- active reservations.
create or replace function public.credit_position(p_client uuid)
returns table (balance integer, reserved integer, available integer)
language sql
stable
security definer set search_path = public
as $$
  with b as (select coalesce(sum(quantity), 0)::int as balance from public.entitlement_ledger where client_id = p_client),
       r as (select count(*)::int as reserved from public.session_reservations where client_id = p_client and status = 'active')
  select b.balance, r.reserved, (b.balance - r.reserved) from b, r
  where p_client = auth.uid() or public.is_my_client(p_client) or public.can_bill() or coalesce(auth.role(), '') = 'service_role';
$$;

-- Sessions move credits automatically: confirmed reserves one (if one is
-- free), held uses it (or takes a free one, if it was booked before payment),
-- cancelled releases it. A no-show keeps the reservation until someone
-- decides (resolve_no_show_credit). Rescheduling changes nothing here: it's
-- the same session. A session with no credit is shown as "not covered".
create or replace function public.coaching_sessions_credits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  res public.session_reservations%rowtype;
begin
  if tg_op = 'UPDATE' and new.state = old.state then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || new.client_id::text));
  select * into res from public.session_reservations where session_id = new.id;

  if new.state = 'confirmed' then
    if (res.session_id is null or res.status = 'released') and public._credit_available(new.client_id) > 0 then
      insert into public.session_reservations (session_id, client_id, status) values (new.id, new.client_id, 'active')
      on conflict (session_id) do update set status = 'active', updated_at = now();
    end if;
  elsif new.state = 'held' then
    if res.status = 'active'
       or ((res.session_id is null or res.status = 'released') and public._credit_available(new.client_id) > 0) then
      insert into public.session_reservations (session_id, client_id, status) values (new.id, new.client_id, 'consumed')
      on conflict (session_id) do update set status = 'consumed', updated_at = now();
      insert into public.entitlement_ledger (client_id, kind, quantity, session_id, reason, operation_key, actor_id)
      values (new.client_id, 'use', -1, new.id, 'Session held', 'use:' || new.id::text, auth.uid())
      on conflict (operation_key) do nothing;
    end if;
  elsif new.state = 'cancelled' then
    if res.status = 'active' then
      update public.session_reservations set status = 'released', updated_at = now() where session_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger coaching_sessions_credits after insert or update of state on public.coaching_sessions
  for each row execute function public.coaching_sessions_credits();

-- A no-show: an explicit decision to use the credit or release it.
create or replace function public.resolve_no_show_credit(p_session uuid, p_use boolean, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  s public.coaching_sessions%rowtype;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can decide this'; end if;
  select * into s from public.coaching_sessions where id = p_session for update;
  if s.state is distinct from 'no_show' then raise exception 'This session isn''t a no-show'; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || s.client_id::text));
  if not exists (select 1 from public.session_reservations where session_id = p_session and status = 'active') then
    return; -- already decided
  end if;
  if p_use then
    update public.session_reservations set status = 'consumed', updated_at = now() where session_id = p_session;
    insert into public.entitlement_ledger (client_id, kind, quantity, session_id, reason, operation_key, actor_id)
    values (s.client_id, 'use', -1, p_session, coalesce(nullif(trim(p_reason), ''), 'No-show: credit used'), 'use:' || p_session::text, auth.uid())
    on conflict (operation_key) do nothing;
  else
    update public.session_reservations set status = 'released', updated_at = now() where session_id = p_session;
  end if;
end;
$$;

-- A labelled, audited adjustment (complimentary session, opening balance).
create or replace function public.adjust_credits(p_client uuid, p_quantity integer, p_reason text, p_operation_key text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_bill() then raise exception 'Only a billing admin can adjust credits'; end if;
  if p_quantity = 0 or abs(p_quantity) > 50 then raise exception 'Adjust by between 1 and 50 credits'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the adjustment'; end if;
  insert into public.entitlement_ledger (client_id, kind, quantity, reason, operation_key, actor_id)
  values (p_client, 'adjust', p_quantity, trim(p_reason), p_operation_key, auth.uid())
  on conflict (operation_key) do nothing;
end;
$$;

-- Invoice maths ---------------------------------------------------------------
create or replace function public.invoice_position(p_invoice uuid)
returns table (total integer, paid integer, credited integer, balance integer)
language sql
stable
security definer set search_path = public
as $$
  select i.total_pence,
         coalesce((select sum(a.amount_pence) from public.receipt_allocations a where a.invoice_id = i.id and a.reversed_at is null), 0)::int,
         coalesce((select sum(c.amount_pence) from public.credit_notes c where c.invoice_id = i.id), 0)::int,
         (i.total_pence
          - coalesce((select sum(c.amount_pence) from public.credit_notes c where c.invoice_id = i.id), 0)
          - coalesce((select sum(a.amount_pence) from public.receipt_allocations a where a.invoice_id = i.id and a.reversed_at is null), 0))::int
  from public.invoices i
  where i.id = p_invoice
    and (public.can_bill() or (i.client_id = auth.uid() and i.status <> 'draft') or coalesce(auth.role(), '') = 'service_role');
$$;

create or replace function public.receipt_unapplied(p_receipt uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select (r.amount_pence
          - coalesce((select sum(a.amount_pence) from public.receipt_allocations a where a.receipt_id = r.id and a.reversed_at is null), 0)
          - coalesce((select sum(f.amount_pence) from public.refunds f where f.receipt_id = r.id), 0))::int
  from public.receipts r
  where r.id = p_receipt and (public.can_bill() or coalesce(auth.role(), '') = 'service_role');
$$;

-- Recalculate a draft's totals from its lines (drafts only).
create or replace function public.refresh_invoice_totals(p_invoice uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  sub integer;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can edit invoices'; end if;
  select coalesce(sum(quantity * unit_pence), 0)::int into sub from public.invoice_items where invoice_id = p_invoice;
  update public.invoices
     set subtotal_pence = sub, total_pence = greatest(sub - discount_pence, 0)
   where id = p_invoice and status = 'draft';
  if exists (select 1 from public.invoices where id = p_invoice and discount_pence > sub) then
    raise exception 'The discount is larger than the invoice';
  end if;
end;
$$;

-- Save a draft in one go: its details and all its lines. The version check
-- stops two open tabs overwriting each other. Returns the new version.
create or replace function public.save_invoice_draft(
  p_invoice uuid, p_expected_version integer, p_items jsonb, p_discount integer,
  p_credits integer, p_service_period text, p_notes text, p_due_date date)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  it jsonb;
  pos integer := 0;
  sub integer;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can edit invoices'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status <> 'draft' then raise exception 'Only a draft can be edited'; end if;
  if inv.version <> p_expected_version then raise exception 'This draft was changed elsewhere. Reload to see the latest.'; end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) > 50 then raise exception 'Up to 50 lines'; end if;
  delete from public.invoice_items where invoice_id = p_invoice;
  for it in select * from jsonb_array_elements(p_items) loop
    pos := pos + 1;
    insert into public.invoice_items (invoice_id, position, description, quantity, unit_pence)
    values (p_invoice, pos, trim(it->>'description'), (it->>'quantity')::int, (it->>'unit_pence')::int);
  end loop;
  select coalesce(sum(quantity * unit_pence), 0)::int into sub from public.invoice_items where invoice_id = p_invoice;
  if coalesce(p_discount, 0) > sub then raise exception 'The discount is larger than the invoice'; end if;
  update public.invoices set
    discount_pence = coalesce(p_discount, 0),
    credits_purchased = coalesce(p_credits, 0),
    service_period = nullif(trim(p_service_period), ''),
    notes = nullif(trim(p_notes), ''),
    due_date = p_due_date,
    subtotal_pence = sub,
    total_pence = sub - coalesce(p_discount, 0),
    version = inv.version + 1
  where id = p_invoice;
  return inv.version + 1;
end;
$$;

-- Issue: number, snapshots and freeze, in one transaction. Safe to retry.
create or replace function public.issue_invoice(p_invoice uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  st public.billing_settings%rowtype;
  cust public.billing_customers%rowtype;
  seq integer;
  sub integer;
  lines integer;
  missing text[] := '{}';
  today date := (now() at time zone 'Europe/London')::date;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can issue invoices'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status = 'issued' then return inv.number; end if;
  if inv.status = 'void' then raise exception 'A void invoice can''t be issued'; end if;

  select * into st from public.billing_settings where id = 1;
  select * into cust from public.billing_customers where client_id = inv.client_id;
  select count(*), coalesce(sum(quantity * unit_pence), 0) into lines, sub from public.invoice_items where invoice_id = inv.id;

  if coalesce(trim(st.legal_name), '') = '' then missing := array_append(missing, 'your legal name (Billing settings)'); end if;
  if coalesce(trim(st.address), '') = '' then missing := array_append(missing, 'your business address (Billing settings)'); end if;
  if coalesce(trim(st.contact_email), '') = '' then missing := array_append(missing, 'a billing contact email (Billing settings)'); end if;
  if coalesce(trim(st.bank_account_name), '') = '' or coalesce(trim(st.bank_sort_code), '') = '' or coalesce(trim(st.bank_account_number), '') = '' then
    missing := array_append(missing, 'bank details for payment (Billing settings)');
  end if;
  if cust.client_id is null or coalesce(trim(cust.name), '') = '' then missing := array_append(missing, 'the customer''s billing name'); end if;
  if lines = 0 then missing := array_append(missing, 'at least one line'); end if;
  if sub - inv.discount_pence <= 0 then missing := array_append(missing, 'a total above £0'); end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Can''t issue yet. Missing: %', array_to_string(missing, '; ');
  end if;

  update public.billing_counters set last_number = last_number + 1 where kind = 'invoice' returning last_number into seq;

  update public.invoices set
    status = 'issued',
    sequence = seq,
    number = st.invoice_prefix || lpad(seq::text, 4, '0'),
    issue_date = coalesce(inv.issue_date, today),
    due_date = coalesce(inv.due_date, coalesce(inv.issue_date, today) + st.payment_terms_days),
    subtotal_pence = sub,
    total_pence = sub - inv.discount_pence,
    supplier = jsonb_build_object(
      'trading_name', st.trading_name, 'legal_name', st.legal_name, 'legal_form', st.legal_form,
      'address', st.address, 'email', st.contact_email, 'phone', st.contact_phone, 'vat_status', st.vat_status),
    customer = jsonb_build_object('name', cust.name, 'email', cust.email, 'address', cust.address),
    payment_instructions = jsonb_build_object(
      'account_name', st.bank_account_name, 'sort_code', st.bank_sort_code, 'account_number', st.bank_account_number,
      'note', st.bank_note, 'terms_days', st.payment_terms_days),
    pdf_status = 'pending',
    issued_at = now(),
    issued_by = auth.uid()
  where id = inv.id;

  return st.invoice_prefix || lpad(seq::text, 4, '0');
end;
$$;

-- Void an issued invoice nothing has been paid against (keeps it on record).
create or replace function public.void_invoice(p_invoice uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invoices%rowtype;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can void invoices'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for voiding'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if inv.status is distinct from 'issued' then raise exception 'Only an issued invoice can be voided'; end if;
  if exists (select 1 from public.receipt_allocations where invoice_id = p_invoice and reversed_at is null) then
    raise exception 'Payments are allocated to this invoice. Reverse them first, or issue a credit note.';
  end if;
  if exists (select 1 from public.entitlement_ledger where invoice_id = p_invoice and kind = 'grant') then
    raise exception 'Credits were granted from this invoice. Issue a credit note instead.';
  end if;
  update public.invoices set status = 'void', voided_at = now(), void_reason = trim(p_reason) where id = p_invoice;
end;
$$;

-- Record a confirmed payment. The operation key (or the provider's id) makes
-- a repeat of the same operation do nothing.
create or replace function public.record_receipt(
  p_client uuid, p_source text, p_external_id text, p_amount integer, p_currency text,
  p_received_on date, p_reference text, p_note text, p_operation_key text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  rid uuid;
begin
  if not (public.can_bill() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Only a billing admin can record payments';
  end if;
  if upper(coalesce(p_currency, '')) <> 'GBP' then raise exception 'Only GBP payments can be recorded'; end if;
  select id into rid from public.receipts where operation_key = p_operation_key
     or (p_external_id is not null and source = p_source and external_id = p_external_id);
  if rid is not null then return rid; end if;
  insert into public.receipts (client_id, source, external_id, amount_pence, currency, received_on, reference, note, operation_key, confirmed_by)
  values (p_client, p_source, p_external_id, p_amount, 'GBP', p_received_on, nullif(trim(p_reference), ''), nullif(trim(p_note), ''), p_operation_key, auth.uid())
  returning id into rid;
  return rid;
end;
$$;

-- Put (part of) a receipt against an invoice of the same client. When the
-- invoice is fully paid, its purchased credits are granted, once.
create or replace function public.allocate_receipt(p_receipt uuid, p_invoice uuid, p_amount integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  rec public.receipts%rowtype;
  inv public.invoices%rowtype;
  unapplied integer;
  bal integer;
begin
  if not (public.can_bill() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Only a billing admin can allocate payments';
  end if;
  select * into inv from public.invoices where id = p_invoice for update;
  select * into rec from public.receipts where id = p_receipt for update;
  if inv.id is null or rec.id is null then raise exception 'Invoice or payment not found'; end if;
  if inv.client_id <> rec.client_id then raise exception 'That payment belongs to a different client'; end if;
  if inv.status <> 'issued' then raise exception 'Payments can only go against an issued invoice'; end if;
  if rec.status <> 'confirmed' then raise exception 'That payment has been reversed'; end if;
  if p_amount <= 0 then raise exception 'Allocate an amount above £0'; end if;

  unapplied := public._receipt_unapplied(rec.id);
  bal := public._invoice_balance(inv.id);
  if p_amount > unapplied then raise exception 'Only £% of that payment is unallocated', to_char(unapplied / 100.0, 'FM999999990.00'); end if;
  if p_amount > bal then raise exception 'Only £% is still owed on this invoice', to_char(bal / 100.0, 'FM999999990.00'); end if;

  insert into public.receipt_allocations (receipt_id, invoice_id, amount_pence, created_by) values (rec.id, inv.id, p_amount, auth.uid());

  if bal - p_amount = 0 and inv.credits_purchased > 0 then
    insert into public.entitlement_ledger (client_id, kind, quantity, invoice_id, reason, operation_key, actor_id)
    values (inv.client_id, 'grant', inv.credits_purchased, inv.id, 'Paid in full: ' || inv.number, 'grant:' || inv.id::text, auth.uid())
    on conflict (operation_key) do nothing;
  end if;
  return bal - p_amount;
end;
$$;

-- Undo an allocation (e.g. put against the wrong invoice). Credits already
-- granted from that invoice stay and are flagged for review in the app.
create or replace function public.reverse_allocation(p_allocation uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_bill() then raise exception 'Only a billing admin can do this'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason'; end if;
  update public.receipt_allocations set reversed_at = now(), reversed_by = auth.uid(), reverse_reason = trim(p_reason)
   where id = p_allocation and reversed_at is null;
  if not found then raise exception 'Allocation not found or already reversed'; end if;
end;
$$;

-- Mark a receipt as entered in error (only with nothing allocated or refunded).
create or replace function public.reverse_receipt(p_receipt uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_bill() then raise exception 'Only a billing admin can do this'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason'; end if;
  if exists (select 1 from public.receipt_allocations where receipt_id = p_receipt and reversed_at is null)
     or exists (select 1 from public.refunds where receipt_id = p_receipt) then
    raise exception 'Reverse its allocations first';
  end if;
  update public.receipts set status = 'reversed', reverse_reason = trim(p_reason) where id = p_receipt and status = 'confirmed';
  if not found then raise exception 'Payment not found or already reversed'; end if;
end;
$$;

-- Credit note: reduces what's owed on an issued invoice (never below zero),
-- optionally removing some of its purchased credits. Has its own numbering.
-- If it settles an invoice that's been partly paid, the remaining credits
-- are granted (the grant and the removal net off in the ledger).
create or replace function public.issue_credit_note(p_invoice uuid, p_amount integer, p_reason text, p_credits_removed integer)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  st public.billing_settings%rowtype;
  bal integer;
  removed integer := greatest(coalesce(p_credits_removed, 0), 0);
  already integer;
  seq integer;
  num text;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can issue credit notes'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the credit note'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if inv.status is distinct from 'issued' then raise exception 'Credit notes are for issued invoices'; end if;
  bal := public._invoice_balance(inv.id);
  if p_amount is null or p_amount <= 0 or p_amount > bal then
    raise exception 'A credit note can be up to £% (what''s still owed). Reverse payments first to credit more.', to_char(bal / 100.0, 'FM999999990.00');
  end if;
  select coalesce(sum(credits_removed), 0) into already from public.credit_notes where invoice_id = inv.id;
  if removed > inv.credits_purchased - already then
    raise exception 'This invoice has only % session credit(s) left to remove', inv.credits_purchased - already;
  end if;
  select * into st from public.billing_settings where id = 1;
  update public.billing_counters set last_number = last_number + 1 where kind = 'credit_note' returning last_number into seq;
  num := st.credit_note_prefix || lpad(seq::text, 4, '0');
  insert into public.credit_notes (invoice_id, client_id, sequence, number, amount_pence, credits_removed, reason, issued_by)
  values (inv.id, inv.client_id, seq, num, p_amount, removed, trim(p_reason), auth.uid());
  if removed > 0 then
    insert into public.entitlement_ledger (client_id, kind, quantity, invoice_id, reason, operation_key, actor_id)
    values (inv.client_id, 'credit_note', -removed, inv.id, 'Credit note ' || num, 'credit_note:' || num, auth.uid());
  end if;
  if bal - p_amount = 0 and inv.credits_purchased > 0
     and exists (select 1 from public.receipt_allocations where invoice_id = inv.id and reversed_at is null) then
    insert into public.entitlement_ledger (client_id, kind, quantity, invoice_id, reason, operation_key, actor_id)
    values (inv.client_id, 'grant', inv.credits_purchased, inv.id, 'Settled: ' || inv.number, 'grant:' || inv.id::text, auth.uid())
    on conflict (operation_key) do nothing;
  end if;
  return num;
end;
$$;

-- Refund money that isn't allocated to any invoice.
create or replace function public.record_refund(p_receipt uuid, p_amount integer, p_reason text, p_refunded_on date)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rec public.receipts%rowtype;
  unapplied integer;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can record refunds'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the refund'; end if;
  select * into rec from public.receipts where id = p_receipt for update;
  if rec.status is distinct from 'confirmed' then raise exception 'Payment not found'; end if;
  unapplied := public._receipt_unapplied(rec.id);
  if p_amount <= 0 or p_amount > unapplied then
    raise exception 'Only £% of this payment is unallocated and can be refunded. Reverse an allocation first.', to_char(unapplied / 100.0, 'FM999999990.00');
  end if;
  insert into public.refunds (receipt_id, client_id, amount_pence, reason, refunded_on, created_by)
  values (rec.id, rec.client_id, p_amount, trim(p_reason), p_refunded_on, auth.uid());
end;
$$;

-- The tracker: every invoice with its money position (billing admins only).
create or replace function public.billing_invoice_list()
returns table (
  id uuid, client_id uuid, client_name text, status text, number text, issue_date date, due_date date,
  total_pence integer, paid_pence integer, credited_pence integer, balance_pence integer,
  pdf_status text, delivery_status text, created_at timestamptz, notices integer
)
language sql
stable
security definer set search_path = public
as $$
  select i.id, i.client_id, coalesce(c.name, p.full_name, p.email), i.status, i.number, i.issue_date, i.due_date,
         i.total_pence, pos.paid, pos.credited, pos.balance, i.pdf_status, i.delivery_status, i.created_at,
         (select count(*)::int from public.payment_notices n where n.invoice_id = i.id and n.status = 'new')
  from public.invoices i
  join public.profiles p on p.id = i.client_id
  left join public.billing_customers c on c.client_id = i.client_id
  cross join lateral public.invoice_position(i.id) pos
  where public.can_bill()
  order by i.created_at desc;
$$;

-- Private storage for invoice PDFs: billing admins write; members read their own.
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false) on conflict (id) do nothing;
drop policy if exists "invoices bucket: billing admin" on storage.objects;
create policy "invoices bucket: billing admin" on storage.objects for all
  using (bucket_id = 'invoices' and public.can_bill()) with check (bucket_id = 'invoices' and public.can_bill());
drop policy if exists "invoices bucket: member reads own" on storage.objects;
create policy "invoices bucket: member reads own" on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function public.issue_invoice(uuid) from public, anon;
revoke all on function public.void_invoice(uuid, text) from public, anon;
revoke all on function public.record_receipt(uuid, text, text, integer, text, date, text, text, text) from public, anon;
revoke all on function public.allocate_receipt(uuid, uuid, integer) from public, anon;
revoke all on function public.reverse_allocation(uuid, text) from public, anon;
revoke all on function public.reverse_receipt(uuid, text) from public, anon;
revoke all on function public.issue_credit_note(uuid, integer, text, integer) from public, anon;
revoke all on function public.record_refund(uuid, integer, text, date) from public, anon;
revoke all on function public.adjust_credits(uuid, integer, text, text) from public, anon;
revoke all on function public.resolve_no_show_credit(uuid, boolean, text) from public, anon;
revoke all on function public.refresh_invoice_totals(uuid) from public, anon;
revoke all on function public.save_invoice_draft(uuid, integer, jsonb, integer, integer, text, text, date) from public, anon;
revoke all on function public.billing_invoice_list() from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;
grant execute on function public.record_receipt(uuid, text, text, integer, text, date, text, text, text) to authenticated, service_role;
grant execute on function public.allocate_receipt(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.reverse_allocation(uuid, text) to authenticated;
grant execute on function public.reverse_receipt(uuid, text) to authenticated;
grant execute on function public.issue_credit_note(uuid, integer, text, integer) to authenticated;
grant execute on function public.record_refund(uuid, integer, text, date) to authenticated;
grant execute on function public.adjust_credits(uuid, integer, text, text) to authenticated;
grant execute on function public.resolve_no_show_credit(uuid, boolean, text) to authenticated;
grant execute on function public.refresh_invoice_totals(uuid) to authenticated;
grant execute on function public.save_invoice_draft(uuid, integer, jsonb, integer, integer, text, text, date) to authenticated;
grant execute on function public.billing_invoice_list() to authenticated;
