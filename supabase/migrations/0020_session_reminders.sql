-- Day-before session reminders: sent by the daily job and logged with the
-- other client emails, so they show in the client's email history and are
-- never sent twice for the same session time.
alter table public.message_jobs drop constraint if exists message_jobs_kind_check;
alter table public.message_jobs add constraint message_jobs_kind_check
  check (kind in ('summary_shared', 'session_update', 'session_reminder', 'invoice_issued', 'payment_received'));
