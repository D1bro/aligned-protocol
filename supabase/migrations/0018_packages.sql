-- 0018: Packages — session bundles and deals the admin sets up, which
-- clients can buy themselves. Safe to run more than once.
--
-- * packages: name, price, sessions, "use within" days, optional dates it's on
--   offer, and who can see it (everyone, or clients the admin picks).
-- * Credits from a package's invoice expire after its "use within" days,
--   counted from when the invoice is fully paid. Sessions use the
--   soonest-expiring credits first; expired credits stop counting.
-- * buy_package: a client buys a package they can see. It issues a normal,
--   numbered invoice in their name (same rules as an admin issuing one), which
--   they pay by card or bank transfer as now; credits arrive when it's paid.

create table if not exists public.packages (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 1 and 120),
  description     text,
  price_pence     integer not null check (price_pence between 100 and 100000000),
  sessions        integer not null check (sessions between 1 and 100),
  valid_days      integer check (valid_days is null or valid_days between 1 and 730),
  available_from  date,
  available_until date,
  audience        text not null default 'everyone' check (audience in ('everyone', 'selected')),
  active          boolean not null default true,
  position        integer not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (available_from is null or available_until is null or available_until >= available_from)
);

create table if not exists public.package_audience (
  package_id uuid not null references public.packages(id) on delete cascade,
  client_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (package_id, client_id)
);

-- Is this package on offer to this client today (UK date)?
create or replace function public._package_open(p_package uuid, p_client uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.packages p
    where p.id = p_package and p.active
      and (p.available_from is null or p.available_from <= (now() at time zone 'Europe/London')::date)
      and (p.available_until is null or p.available_until >= (now() at time zone 'Europe/London')::date)
      and (p.audience = 'everyone' or exists (select 1 from public.package_audience a where a.package_id = p.id and a.client_id = p_client))
  );
$$;
revoke all on function public._package_open(uuid, uuid) from public, anon;
-- Members' row rule calls it; it only answers "is this on offer to me".
grant execute on function public._package_open(uuid, uuid) to authenticated;

alter table public.packages enable row level security;
drop policy if exists "packages: billing admin" on public.packages;
create policy "packages: billing admin" on public.packages for all using (public.can_bill()) with check (public.can_bill());
drop policy if exists "packages: members see what's on offer to them" on public.packages;
create policy "packages: members see what's on offer to them" on public.packages for select using (public._package_open(id, auth.uid()));

alter table public.package_audience enable row level security;
drop policy if exists "package_audience: billing admin" on public.package_audience;
create policy "package_audience: billing admin" on public.package_audience for all using (public.can_bill()) with check (public.can_bill());

drop trigger if exists packages_touch on public.packages;
create trigger packages_touch before update on public.packages for each row execute function public.touch_updated_at();

-- Invoices remember the package and how long its credits last.
alter table public.invoices add column if not exists package_id uuid references public.packages(id) on delete restrict;
alter table public.invoices add column if not exists credits_valid_days integer;
alter table public.invoices drop constraint if exists invoices_credits_valid_days_check;
alter table public.invoices add constraint invoices_credits_valid_days_check check (credits_valid_days is null or credits_valid_days between 1 and 730);

-- Once issued, the package and its "use within" days are frozen like the
-- rest of the invoice.
create or replace function public.invoices_package_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' and (new.package_id is distinct from old.package_id or new.credits_valid_days is distinct from old.credits_valid_days) then
    raise exception 'An issued invoice can''t be changed. Void it or issue a credit note instead.';
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_package_guard on public.invoices;
create trigger invoices_package_guard before update on public.invoices for each row execute function public.invoices_package_guard();

-- Credits granted from such an invoice carry an expiry date.
alter table public.entitlement_ledger add column if not exists expires_at timestamptz;

create or replace function public.entitlement_grant_expiry()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  d integer;
begin
  if new.kind = 'grant' and new.invoice_id is not null and new.expires_at is null then
    select credits_valid_days into d from public.invoices where id = new.invoice_id;
    if d is not null then new.expires_at := now() + make_interval(days => d); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists entitlement_grant_expiry on public.entitlement_ledger;
create trigger entitlement_grant_expiry before insert on public.entitlement_ledger
  for each row execute function public.entitlement_grant_expiry();

-- Credits available now. Walks the ledger in time order: each use (and each
-- negative adjustment) takes from the credits that were valid at that moment,
-- soonest-expiring first; credits held for confirmed sessions are taken now.
-- What's left in credits that haven't expired is what can be used.
create or replace function public._credit_available(p_client uuid)
returns integer
language plpgsql
stable
security definer set search_path = public
as $$
declare
  g_qty integer[] := '{}';
  g_exp timestamptz[] := '{}';
  g_at timestamptz[] := '{}';
  ev record;
  need integer;
  i integer;
  best integer;
  avail integer := 0;
  debt integer := 0;
begin
  for ev in
    select created_at as at, quantity, expires_at, 0 as ord from public.entitlement_ledger where client_id = p_client
    union all
    select now(), -count(*)::int, null, 1 from public.session_reservations where client_id = p_client and status = 'active' having count(*) > 0
    order by at, ord
  loop
    if ev.quantity > 0 then
      g_qty := g_qty || ev.quantity;
      g_exp := g_exp || ev.expires_at;
      g_at := g_at || ev.at;
    else
      need := -ev.quantity;
      while need > 0 loop
        best := null;
        for i in 1 .. coalesce(array_length(g_qty, 1), 0) loop
          if g_qty[i] > 0 and g_at[i] <= ev.at and (g_exp[i] is null or g_exp[i] > ev.at)
             and (best is null or coalesce(g_exp[i], 'infinity') < coalesce(g_exp[best], 'infinity')) then
            best := i;
          end if;
        end loop;
        exit when best is null;
        if g_qty[best] >= need then
          g_qty[best] := g_qty[best] - need;
          need := 0;
        else
          need := need - g_qty[best];
          g_qty[best] := 0;
        end if;
      end loop;
      debt := debt + need;
    end if;
  end loop;
  for i in 1 .. coalesce(array_length(g_qty, 1), 0) loop
    if g_exp[i] is null or g_exp[i] > now() then avail := avail + g_qty[i]; end if;
  end loop;
  return greatest(avail - debt, 0);
end;
$$;
revoke all on function public._credit_available(uuid) from public, anon, authenticated;

-- The balance shown in the app, with expiry taken into account:
-- available + reserved = what the client holds.
create or replace function public.credit_position(p_client uuid)
returns table (balance integer, reserved integer, available integer)
language sql
stable
security definer set search_path = public
as $$
  with r as (select count(*)::int as reserved from public.session_reservations where client_id = p_client and status = 'active'),
       a as (select public._credit_available(p_client) as available)
  select a.available + r.reserved, r.reserved, a.available from a, r
  where p_client = auth.uid() or public.is_my_client(p_client) or public.can_bill() or coalesce(auth.role(), '') = 'service_role';
$$;

-- When the client's next credits expire (for "use by" on their page).
create or replace function public.credit_expiries(p_client uuid)
returns table (expires_at timestamptz, quantity integer)
language sql
stable
security definer set search_path = public
as $$
  select l.expires_at, l.quantity from public.entitlement_ledger l
  where l.client_id = p_client and l.kind = 'grant' and l.expires_at > now()
    and (p_client = auth.uid() or public.is_my_client(p_client) or public.can_bill())
  order by l.expires_at;
$$;

-- Issuing, split so buy_package can issue the client's own invoice: the
-- permission check stays in issue_invoice; the work moves to _issue_invoice.
create or replace function public._issue_invoice(p_invoice uuid)
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
revoke all on function public._issue_invoice(uuid) from public, anon, authenticated;

create or replace function public.issue_invoice(p_invoice uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.can_bill() then raise exception 'Only a billing admin can issue invoices'; end if;
  return public._issue_invoice(p_invoice);
end;
$$;

-- A client buys a package on offer to them. Issues a normal invoice in
-- their name; an unpaid one for the same package is reused, not duplicated.
create or replace function public.buy_package(p_package uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  p public.packages%rowtype;
  existing uuid;
  inv uuid;
  prof record;
begin
  if me is null or not exists (select 1 from auth.users u where u.id = me and not coalesce(u.is_anonymous, true)) then
    raise exception 'Create your account first, then you can buy sessions';
  end if;
  select id, full_name, email into prof from public.profiles where id = me;
  if prof.id is null then raise exception 'Please sign in again'; end if;
  if not public._package_open(p_package, me) then raise exception 'This package isn''t available to you'; end if;
  select * into p from public.packages where id = p_package;

  perform pg_advisory_xact_lock(hashtext('buy:' || me::text));
  select i.id into existing from public.invoices i
   where i.client_id = me and i.package_id = p.id and i.status = 'issued' and public._invoice_balance(i.id) > 0
   order by i.issued_at desc limit 1;
  if existing is not null then return existing; end if;

  insert into public.billing_customers (client_id, name, email)
  values (me, coalesce(nullif(trim(prof.full_name), ''), prof.email, 'Client'), prof.email)
  on conflict (client_id) do nothing;

  insert into public.invoices (client_id, credits_purchased, package_id, credits_valid_days, service_period, created_by)
  values (me, p.sessions, p.id, p.valid_days, p.name, me)
  returning id into inv;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_pence)
  values (inv, 1, p.name || ' (' || p.sessions || case when p.sessions = 1 then ' session' else ' sessions' end ||
                  case when p.valid_days is null then '' else ', to use within ' || p.valid_days || ' days' end || ')', 1, p.price_pence);
  update public.invoices set subtotal_pence = p.price_pence, total_pence = p.price_pence where id = inv;
  perform public._issue_invoice(inv);
  return inv;
end;
$$;
revoke all on function public.buy_package(uuid) from public, anon;
grant execute on function public.buy_package(uuid) to authenticated;

-- An admin starts a draft invoice for a client from a package (then reviews
-- and issues it as usual).
create or replace function public.draft_invoice_from_package(p_client uuid, p_package uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  p public.packages%rowtype;
  inv uuid;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can create invoices'; end if;
  select * into p from public.packages where id = p_package;
  if p.id is null then raise exception 'Package not found'; end if;
  insert into public.invoices (client_id, credits_purchased, package_id, credits_valid_days, service_period, created_by)
  values (p_client, p.sessions, p.id, p.valid_days, p.name, auth.uid())
  returning id into inv;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_pence)
  values (inv, 1, p.name || ' (' || p.sessions || case when p.sessions = 1 then ' session' else ' sessions' end ||
                  case when p.valid_days is null then '' else ', to use within ' || p.valid_days || ' days' end || ')', 1, p.price_pence);
  update public.invoices set subtotal_pence = p.price_pence, total_pence = p.price_pence where id = inv;
  return inv;
end;
$$;
revoke all on function public.draft_invoice_from_package(uuid, uuid) from public, anon;
grant execute on function public.draft_invoice_from_package(uuid, uuid) to authenticated;
