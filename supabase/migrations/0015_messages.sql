-- 0015_messages.sql
-- Emails to clients about their coaching and billing. Sharing something in
-- the app and emailing about it are separate steps: nothing here is sent
-- automatically. Each email is one row, so a repeat click can't send twice
-- (dedupe_key), and its state is visible: queued -> sent, or failed.
-- Run on the TEST project first; live only after review.

create table if not exists public.message_jobs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('summary_shared', 'session_update', 'invoice_issued', 'payment_received')),
  dedupe_key    text not null unique,
  to_email      text not null,
  subject       text not null,
  body_text     text not null,
  personal_note text,
  session_id    uuid references public.coaching_sessions(id) on delete set null,
  summary_id    uuid references public.session_summaries(id) on delete set null,
  invoice_id    uuid references public.invoices(id) on delete set null,
  receipt_id    uuid references public.receipts(id) on delete set null,
  status        text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id   text,
  error         text,
  attempts      integer not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists message_jobs_client_idx on public.message_jobs (client_id, created_at desc);

alter table public.message_jobs enable row level security;

-- Coaching emails: the client's coach (or an admin). Billing emails: billing admins only.
create policy "message_jobs: staff" on public.message_jobs for all
  using (case when kind in ('invoice_issued', 'payment_received') then public.can_bill() else public.is_my_client(client_id) end)
  with check (case when kind in ('invoice_issued', 'payment_received') then public.can_bill() else public.is_my_client(client_id) end);
