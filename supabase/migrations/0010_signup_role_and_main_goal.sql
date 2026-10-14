-- 0010_signup_role_and_main_goal.sql
-- Run in the Supabase SQL Editor BEFORE deploying the matching app change
-- (the app calls set_main_goal).

-- 1. Security: every new sign-up is a client. Previously the role came from
-- the sign-up metadata, which the person signing up controls, so anyone
-- could create a coach or admin account. Coaches and admins are made by
-- changing the role in the SQL Editor (or Table Editor), never at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'client'
  );
  return new;
end;
$$;

-- 2. Choosing the main goal in one step. A function runs as a single
-- transaction, so the chosen goal becoming 'primary' and the others becoming
-- 'supporting' either both happen or neither does. Runs with the member's
-- own permissions (security invoker), so it only touches their own goals.
create or replace function public.set_main_goal(p_goal_id uuid)
returns boolean
language plpgsql
security invoker set search_path = public
as $$
declare
  chosen int;
begin
  update public.goals
     set goal_type = 'primary'
   where id = p_goal_id and client_id = auth.uid() and status = 'active';
  get diagnostics chosen = row_count;
  if chosen = 0 then
    return false;
  end if;
  update public.goals
     set goal_type = 'supporting'
   where client_id = auth.uid() and status = 'active' and id <> p_goal_id;
  return true;
end;
$$;

revoke all on function public.set_main_goal(uuid) from public;
grant execute on function public.set_main_goal(uuid) to authenticated;
