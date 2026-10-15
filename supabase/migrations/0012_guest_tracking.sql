-- 0012_guest_tracking.sql
-- Honest guest numbers. From this release a guest sign-in is only created
-- when someone presses "Begin my audit", so the audit welcome page is shown
-- to people with no sign-in at all; it needs the ten area names.
-- The console now counts guests who actually started (answered at least one
-- question) and finished, and leaves empty guest sign-ins out of the list.
-- Run in the SQL Editor (test project first, then live) BEFORE deploying.

-- The ten area names and descriptions are public content.
drop policy if exists "life_areas: anyone can read" on public.life_areas;
create policy "life_areas: anyone can read" on public.life_areas for select using (true);

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
    -- Guests: people who pressed Begin without an account and answered at
    -- least one question. Empty guest sign-ins (link previews, crawlers,
    -- people who only looked) are not counted.
    'guests', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id
                where c.email is null and exists (select 1 from public.audit_responses r where r.audit_id = a.id)),
    'guests_finished', (select count(distinct a.client_id) from public.audits a join clients c on c.id = a.client_id
                         where c.email is null and a.status = 'completed'),
    'guest_signins_empty', (select count(*) from clients c where c.email is null
                             and not exists (select 1 from public.audits a where a.client_id = c.id)),
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
    -- leave out empty guest sign-ins: no account and no audit started
    and (p.email is not null or exists (select 1 from public.audits a where a.client_id = p.id))
  order by 18 desc nulls last;
$$;

