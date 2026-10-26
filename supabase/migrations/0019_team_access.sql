-- Team and access (console Settings): admins manage who is on the team, and
-- billing admins choose which other admins may manage billing.
--
-- Profiles can only be updated by their owner, so these changes go through
-- functions that check the caller first.

-- Billing access: only a billing admin can grant or remove it, only admins
-- can hold it, and nobody can remove their own (so there is always at least
-- one billing admin).
create or replace function public.admin_set_billing(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  if not public.can_bill() then raise exception 'Only a billing admin can change billing access'; end if;
  if p_user = auth.uid() and not p_on then
    raise exception 'You can''t remove your own billing access';
  end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'No such account'; end if;
  if p_on and v_role <> 'admin' then raise exception 'Make them an admin first'; end if;
  update public.profiles set can_manage_billing = p_on where id = p_user;
end;
$$;

-- Changing someone's role (replaces 0011's version). Moving a billing admin
-- off admin also removes their billing access, so it can't quietly come back
-- if they're made admin again later; only a billing admin can do that.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_billing boolean;
begin
  if not public.is_admin() then raise exception 'Only an admin can do this'; end if;
  if p_role not in ('client', 'coach', 'admin') then raise exception 'Unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You can''t remove your own admin access';
  end if;
  select can_manage_billing into v_billing from public.profiles where id = p_user;
  if not found then raise exception 'No such account'; end if;
  if v_billing and p_role <> 'admin' then
    if not public.can_bill() then raise exception 'Only a billing admin can change a billing admin''s role'; end if;
    update public.profiles set role = p_role, can_manage_billing = false where id = p_user;
  else
    update public.profiles set role = p_role where id = p_user;
  end if;
end;
$$;

revoke all on function public.admin_set_billing(uuid, boolean) from public, anon;
grant execute on function public.admin_set_billing(uuid, boolean) to authenticated;
