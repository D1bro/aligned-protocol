-- 0016_member_details.sql
-- "Your details": optional contact and location fields on the member's own
-- profile, and a narrow way for a member to keep their own billing name and
-- address up to date. Safe to run more than once. Test project first.
--
-- Who sees what:
--   member          their own details and billing name/address
--   assigned coach  name, preferred name, phone, town/city, country, time
--                   zone (through the existing "coach reads own clients"
--                   rule on profiles) — never billing details
--   billing admin   billing details, as before
-- Issued invoices keep their own copy of the customer details, so editing
-- here never changes an invoice that has already been sent.

alter table public.profiles add column if not exists preferred_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists town text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists details_prompt_dismissed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_details_lengths;
alter table public.profiles add constraint profiles_details_lengths check (
  coalesce(length(preferred_name), 0) <= 80
  and coalesce(length(phone), 0) <= 40
  and coalesce(length(town), 0) <= 120
  and coalesce(length(country), 0) <= 80
  and coalesce(length(timezone), 0) <= 64
);

-- A member's own billing name and postal address. Only these two fields, only
-- for the signed-in member; email, invoices and everything else stay with
-- billing staff. A blank billing name falls back to their full name, because
-- invoices always need a name.
create or replace function public.save_my_billing_details(p_name text, p_address text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  fallback text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if coalesce(length(v_name), 0) > 200 then raise exception 'That billing name is too long'; end if;
  if coalesce(length(v_address), 0) > 600 then raise exception 'That address is too long'; end if;
  select nullif(btrim(coalesce(full_name, '')), '') into fallback from public.profiles where id = me;

  if exists (select 1 from public.billing_customers where client_id = me) then
    update public.billing_customers
       set name = coalesce(v_name, fallback, name), address = v_address, updated_at = now()
     where client_id = me;
  elsif v_name is not null or v_address is not null then
    insert into public.billing_customers (client_id, name, email, address)
    select me, coalesce(v_name, fallback, 'Member'), p.email, v_address from public.profiles p where p.id = me;
  end if;
end;
$$;
revoke all on function public.save_my_billing_details(text, text) from public, anon;
grant execute on function public.save_my_billing_details(text, text) to authenticated;
