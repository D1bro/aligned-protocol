-- remove-empty-guest-signins.sql
-- Removes guest sign-ins that never started the audit: link previews,
-- crawlers and visits from before "Begin my audit" created the sign-in.
-- Keeps every member (anyone with an email) and every guest who started an
-- audit. Deleting is permanent. Run step 1 first and check the numbers.

-- STEP 1 — preview (changes nothing)
select
  count(*) filter (where u.is_anonymous)                                         as all_guest_signins,
  count(*) filter (where u.is_anonymous
                     and not exists (select 1 from public.audits a where a.client_id = u.id)
                     and u.created_at < now() - interval '1 day')                as would_be_removed,
  count(*) filter (where not u.is_anonymous)                                     as members_kept
from auth.users u;

-- STEP 2 — remove them (only after checking step 1)
-- delete from auth.users u
-- where u.is_anonymous
--   and not exists (select 1 from public.audits a where a.client_id = u.id)
--   and u.created_at < now() - interval '1 day';
