-- 0037_followups.sql
-- Follow-up emails after the audit (Duane, 24 Nov 2026): four short emails
-- from Duane on days 1, 3, 7 and 10 after someone's first audit, only for
-- people who ticked "Send me a few short emails from Duane" when they made
-- their account. Unticked by default, like the check-in email (0033).
--
-- Additive: existing members keep followups_email = false, so nobody who
-- joined before this gets them.

-- 1. The choice, and when it was made (day 1 counts from the later of this
--    and their first finished audit, so a guest's day 1 is the day after
--    they saved their plan).
alter table public.profiles add column if not exists followups_email boolean not null default false;
alter table public.profiles add column if not exists followups_at timestamptz;

-- 2. New accounts take the choice from the sign-up form (account metadata),
--    as reminders_email already does.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wants_followups boolean := coalesce(new.raw_user_meta_data ->> 'followups_email', 'false') = 'true';
begin
  insert into public.profiles (id, email, full_name, role, reminders_email, followups_email, followups_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'client',
    coalesce(new.raw_user_meta_data ->> 'reminders_email', 'false') = 'true',
    wants_followups,
    case when wants_followups then now() end
  );
  return new;
end;
$$;

-- 3. Each follow-up is logged in message_jobs like every other client email,
--    keyed "followup:<client>:<day>" so it can only go once.
alter table public.message_jobs drop constraint if exists message_jobs_kind_check;
alter table public.message_jobs add constraint message_jobs_kind_check
  check (kind in ('summary_shared', 'session_update', 'session_reminder', 'invoice_issued', 'payment_received', 'followup'));
