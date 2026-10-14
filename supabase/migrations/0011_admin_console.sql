-- 0011_admin_console.sql
-- The admin console (/coach, signed in with an admin account).
-- Run in the Supabase SQL Editor BEFORE deploying the matching app change.
--
-- Admins can see every client's work through the same rules coaches use for
-- their own clients. Private things stay private: tool answers and lesson
-- reflections marked private are never readable by a coach or admin (the
-- console only shows lesson COUNTS for those, via admin_client_list).
-- Changing someone's role or coach goes through admin-only functions.
--
-- After running this, make your own account an admin (once), e.g.:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Who is an admin ----------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- "My client" now includes every client for an admin. Every existing coach
-- read policy (audits, answers, plans, goals, check-ins, session notes,
-- shared lesson reflections) uses this, so admins get the same view.
create or replace function public.is_my_client(target_client_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.profiles where id = target_client_id and coach_id = auth.uid()
  );
$$;

drop policy if exists "profiles: admin reads all" on public.profiles;
create policy "profiles: admin reads all" on public.profiles for select using (public.is_admin());

drop policy if exists "reminder_log: admin reads all" on public.reminder_log;
create policy "reminder_log: admin reads all" on public.reminder_log for select using (public.is_admin());

-- Profile guard (from 0008): admins may change role and coach, but only
-- through the functions below (they check is_admin themselves).
create or replace function public.profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_admin() and (
       new.role is distinct from old.role
    or new.coach_id is distinct from old.coach_id
    or new.email_token is distinct from old.email_token
    or (old.email is not null and new.email is distinct from old.email)
  ) then
    raise exception 'This profile field can''t be changed here';
  end if;
  return new;
end;
$$;

-- Admin actions ------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this'; end if;
  if p_role not in ('client', 'coach', 'admin') then raise exception 'Unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You can''t remove your own admin access';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'No such account'; end if;
end;
$$;

create or replace function public.admin_assign_coach(p_client uuid, p_coach uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this'; end if;
  if p_coach is not null and p_coach = p_client then raise exception 'Someone can''t be their own coach'; end if;
  if p_coach is not null and not exists (
    select 1 from public.profiles where id = p_coach and role in ('coach', 'admin')
  ) then
    raise exception 'That person isn''t a coach';
  end if;
  update public.profiles set coach_id = p_coach where id = p_client;
  if not found then raise exception 'No such account'; end if;
end;
$$;

-- The numbers --------------------------------------------------------------
-- Counts only, across every client. Guests = people who started the audit
-- without an account (no email yet).
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can see this'; end if;

  with clients as (
    select id, email, created_at from public.profiles where role = 'client'
  ),
  members as (
    select * from clients where email is not null
  ),
  activity as (
    select client_id, completed_at::date as d from public.audits where status = 'completed' and completed_at is not null
    union select client_id, created_at::date from public.goals
    union select client_id, created_at::date from public.goal_checkins
    union select client_id, updated_at::date from public.lesson_progress
    union select client_id, updated_at::date from public.tool_entries
  ),
  member_activity as (
    select a.client_id, a.d from activity a join members m on m.id = a.client_id
  )
  select jsonb_build_object(
    'members', (select count(*) from members),
    'members_30d', (select count(*) from members where created_at > now() - interval '30 days'),
    'guests', (select count(*) from clients where email is null),
    'audits', (select count(*) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'audits_30d', (select count(*) from public.audits a join clients c on c.id = a.client_id
                    where a.status = 'completed' and a.completed_at > now() - interval '30 days'),
    'people_audited', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id where a.status = 'completed'),
    'members_audited', (select count(distinct a.client_id) from public.audits a join members m on m.id = a.client_id where a.status = 'completed'),
    'plans_set', (select count(distinct g.client_id) from public.goals g join members m on m.id = g.client_id
                   where coalesce(trim(g.frequency), '') <> '' and coalesce(trim(g.success_criteria), '') <> ''),
    'first_action', (select count(distinct gc.client_id) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.did_it <> 'not_yet'),
    'checkins', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id),
    'checkins_30d', (select count(*) from public.goal_checkins gc join members m on m.id = gc.client_id
                      where gc.created_at > now() - interval '30 days'),
    'goals_done', (select count(*) from public.goals g join members m on m.id = g.client_id where g.status = 'completed'),
    'lessons_done', (select count(*) from public.lesson_progress lp join members m on m.id = lp.client_id where lp.completed_at is not null),
    'people_learning', (select count(distinct lp.client_id) from public.lesson_progress lp join members m on m.id = lp.client_id
                         where lp.completed_at is not null),
    'came_back', (select count(*) from (select client_id from member_activity group by client_id having count(distinct d) >= 2) x),
    'active_30d', (select count(distinct client_id) from member_activity where d > current_date - 30),
    'enquiries', (select count(*) from public.coaching_enquiries),
    'enquiries_new', (select count(*) from public.coaching_enquiries where status = 'new'),
    'enquiries_booked', (select count(*) from public.coaching_enquiries where status = 'booked')
  ) into result;
  return result;
end;
$$;

-- The client list: one row per client with their progress. Admins see every
-- client; a coach sees only their own.
create or replace function public.admin_client_list()
returns table (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  coach_id uuid,
  coach_name text,
  audits int,
  last_audit_at timestamptz,
  last_audit_score int,
  main_goal text,
  main_goal_area text,
  plan_set boolean,
  active_goals int,
  goals_done int,
  checkins int,
  last_checkin_at timestamptz,
  lessons_done int,
  last_active_at timestamptz,
  enquiry_status text
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.created_at, p.coach_id, c.full_name,
    (select count(*)::int from public.audits a where a.client_id = p.id and a.status = 'completed'),
    la.completed_at, la.total_score,
    mg.goal_title, mg.focus_area,
    (mg.id is not null and coalesce(trim(mg.frequency), '') <> '' and coalesce(trim(mg.success_criteria), '') <> ''),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'active'),
    (select count(*)::int from public.goals g where g.client_id = p.id and g.status = 'completed'),
    (select count(*)::int from public.goal_checkins gc where gc.client_id = p.id),
    (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
    (select count(*)::int from public.lesson_progress lp where lp.client_id = p.id and lp.completed_at is not null),
    greatest(
      p.created_at,
      la.completed_at,
      (select max(g.created_at) from public.goals g where g.client_id = p.id),
      (select max(gc.created_at) from public.goal_checkins gc where gc.client_id = p.id),
      (select max(lp.updated_at) from public.lesson_progress lp where lp.client_id = p.id)
    ),
    (select e.status from public.coaching_enquiries e where e.client_id = p.id order by e.created_at desc limit 1)
  from public.profiles p
  left join public.profiles c on c.id = p.coach_id
  left join lateral (
    select a.completed_at, a.total_score from public.audits a
    where a.client_id = p.id and a.status = 'completed'
    order by a.completed_at desc limit 1
  ) la on true
  left join lateral (
    select g.id, g.goal_title, g.focus_area, g.frequency, g.success_criteria from public.goals g
    where g.client_id = p.id and g.status = 'active'
    order by (g.goal_type = 'primary') desc, g.created_at desc limit 1
  ) mg on true
  where p.role = 'client' and (public.is_admin() or p.coach_id = auth.uid())
  order by 18 desc nulls last;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_assign_coach(uuid, uuid) from public, anon;
revoke all on function public.admin_metrics() from public, anon;
revoke all on function public.admin_client_list() from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_assign_coach(uuid, uuid) to authenticated;
grant execute on function public.admin_metrics() to authenticated;
grant execute on function public.admin_client_list() to authenticated;
