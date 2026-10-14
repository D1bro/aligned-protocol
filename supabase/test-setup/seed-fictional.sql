-- seed-fictional.sql — TEST PROJECT (aligned-test) ONLY.
-- Makes the test coach an admin and coach of Sam Fictional, and gives Sam a
-- fictional completed audit, CLEAR plan and goal to coach from. Robin stays
-- an unrelated client (for checking one client can't see another).
-- Refuses to run unless the three fictional test accounts exist.

do $$
declare
  v_coach uuid;
  v_sam uuid;
  v_robin uuid;
  v_audit uuid;
  v_area_money uuid;
  v_plan uuid;
  r record;
  scores int[] := array[7, 6, 5, 6, 7, 4, 6, 5, 6, 7];
  i int := 0;
begin
  select id into v_coach from public.profiles where email = 'coach.test@example.com';
  select id into v_sam from public.profiles where email = 'sam.fictional@example.com';
  select id into v_robin from public.profiles where email = 'robin.unrelated@example.com';
  if v_coach is null or v_sam is null or v_robin is null then
    raise exception 'The fictional test accounts were not found. Is this the aligned-test project?';
  end if;
  if exists (select 1 from public.audits where client_id = v_sam) then
    raise notice 'Sam already has an audit; leaving the fictional history as it is.';
  else
    insert into public.audits (client_id, status, sequence_number, total_score, completed_at)
    values (v_sam, 'completed', 1, 59, now() - interval '20 days')
    returning id into v_audit;

    for r in select id, sort_order from public.life_areas order by sort_order loop
      i := i + 1;
      insert into public.audit_responses (audit_id, life_area_id, satisfaction_score, importance_score, note)
      values (
        v_audit, r.id, scores[i], 3,
        case r.sort_order
          when 6 then 'Money feels tight and I avoid looking at it.'
          when 8 then 'Evenings disappear; I mean to plan but don''t.'
          else null
        end
      );
    end loop;

    select id into v_area_money from public.life_areas where sort_order = 6;
    insert into public.clear_plans (client_id, audit_id, life_area_id, current_reality, life_vision, emotional_blocks,
                                    step_up_target, step_up_answer, if_obstacle, if_response)
    values (v_sam, v_audit, v_area_money,
            'What isn''t working: I don''t know where the money goes each month.',
            'At a 10 I know my numbers and feel calm about them.',
            'Avoidance — looking at it makes me anxious.',
            5, 'I check my account once a week and know what''s left.',
            'I skip Sunday', 'do it Monday before work')
    returning id into v_plan;

    insert into public.goals (client_id, clear_plan_id, goal_title, goal_type, focus_area, action_text, frequency, action_when,
                              success_criteria, motivation_text)
    values (v_sam, v_plan, 'Every Sunday at 6pm, I''ll spend ten minutes checking my account and updating my spending sheet.',
            'primary', 'Money & Stability', 'Spend ten minutes checking my account and updating my spending sheet',
            'Weekly', 'Every Sunday at 6pm',
            'Four Sundays in a row with the sheet up to date.', 'I want to stop feeling sick when I open my banking app.');
  end if;

  -- Roles and coaching link (allowed from the SQL Editor; blocked for members).
  update public.profiles set role = 'admin' where id = v_coach;
  update public.profiles set coach_id = v_coach where id = v_sam;
  update public.profiles set coach_id = null where id = v_robin;
  insert into public.coaching_relationships (client_id, status, started_on)
  values (v_sam, 'active', current_date - 20)
  on conflict (client_id) do nothing;
end;
$$;

select email, role, coach_id is not null as has_coach from public.profiles
where email in ('coach.test@example.com', 'sam.fictional@example.com', 'robin.unrelated@example.com')
order by email;
