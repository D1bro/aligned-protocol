-- 0013_coaching_core.sql
-- The coaching workspace: sessions and their history, private coach notes,
-- transcripts, reviewed session summaries published to the member, agreed
-- commitments and member updates, and member preparation.
-- Additive only. Run on the TEST project first; live only after review.
--
-- Access in short:
--   member         own sessions, own PUBLISHED summaries, commitments meant
--                  for them, own updates and preparation
--   assigned coach their clients' sessions, summaries, commitments, shared
--                  preparation; private notes and transcripts
--   admin          sessions and summaries for every client (is_my_client),
--                  but NOT private notes or transcripts unless they are the
--                  assigned coach or the author

-- Helpers -----------------------------------------------------------------
create or replace function public.is_assigned_coach(target_client_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = target_client_id and coach_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Coaching relationship ----------------------------------------------------
create table if not exists public.coaching_relationships (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  status      text not null default 'active' check (status in ('enquiry', 'active', 'paused', 'ended')),
  started_on  date,
  updated_at  timestamptz not null default now()
);
alter table public.coaching_relationships enable row level security;
create policy "coaching_relationships: staff" on public.coaching_relationships for all
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
create policy "coaching_relationships: member reads own" on public.coaching_relationships for select
  using (client_id = auth.uid());

-- Sessions -----------------------------------------------------------------
-- One row per conversation. Rescheduling changes this row and records the
-- old and new times in coaching_session_events, so a moved session is never
-- counted twice. Times are stored in UTC with the named timezone.
create table if not exists public.coaching_sessions (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.profiles(id) on delete cascade,
  coach_id            uuid references public.profiles(id) on delete set null,
  scheduled_at        timestamptz not null,
  timezone            text not null default 'Europe/London',
  duration_minutes    integer not null default 60 check (duration_minutes between 5 and 600),
  state               text not null default 'proposed'
                      check (state in ('proposed', 'confirmed', 'held', 'cancelled', 'no_show')),
  location            text,
  previous_session_id uuid references public.coaching_sessions(id) on delete set null,
  -- context at the time of the session (later audits don't rewrite it)
  audit_id            uuid references public.audits(id) on delete set null,
  goal_id             uuid references public.goals(id) on delete set null,
  goal_snapshot       jsonb,
  held_at             timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,
  no_show_decision    text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists coaching_sessions_client_idx on public.coaching_sessions (client_id, scheduled_at desc);
alter table public.coaching_sessions enable row level security;
create policy "coaching_sessions: staff" on public.coaching_sessions for all
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
create policy "coaching_sessions: member reads own" on public.coaching_sessions for select
  using (client_id = auth.uid());
create trigger coaching_sessions_touch before update on public.coaching_sessions
  for each row execute function public.touch_updated_at();

-- Context references must belong to the same client.
create or replace function public.coaching_sessions_check_refs()
returns trigger
language plpgsql
as $$
begin
  if new.audit_id is not null and not exists (select 1 from public.audits where id = new.audit_id and client_id = new.client_id) then
    raise exception 'That audit belongs to someone else';
  end if;
  if new.goal_id is not null and not exists (select 1 from public.goals where id = new.goal_id and client_id = new.client_id) then
    raise exception 'That goal belongs to someone else';
  end if;
  if new.previous_session_id is not null and not exists (
    select 1 from public.coaching_sessions where id = new.previous_session_id and client_id = new.client_id
  ) then
    raise exception 'That session belongs to someone else';
  end if;
  return new;
end;
$$;
create trigger coaching_sessions_refs before insert or update on public.coaching_sessions
  for each row execute function public.coaching_sessions_check_refs();

create table if not exists public.coaching_session_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.coaching_sessions(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('created', 'confirmed', 'rescheduled', 'held', 'cancelled', 'no_show', 'reopened')),
  from_at     timestamptz,
  to_at       timestamptz,
  note        text,
  actor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.coaching_session_events enable row level security;
create policy "coaching_session_events: staff" on public.coaching_session_events for all
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id) and actor_id = auth.uid());

-- Private coach notes ------------------------------------------------------
-- Never shown to the member. Readable only by the author or the client's
-- assigned coach. `version` guards against two tabs overwriting each other.
create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid references public.coaching_sessions(id) on delete set null,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null default '',
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists coach_notes_one_per_session on public.coach_notes (session_id, author_id) where session_id is not null;
alter table public.coach_notes enable row level security;
create policy "coach_notes: author or assigned coach" on public.coach_notes for all
  using (author_id = auth.uid() or public.is_assigned_coach(client_id))
  with check (author_id = auth.uid() and public.is_my_client(client_id));
create trigger coach_notes_touch before update on public.coach_notes
  for each row execute function public.touch_updated_at();

-- Transcripts --------------------------------------------------------------
-- Pasted or uploaded text. Restricted like private notes. The content hash
-- stops the same transcript being imported twice for a session.
create table if not exists public.session_transcripts (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  session_id         uuid not null references public.coaching_sessions(id) on delete cascade,
  source             text not null check (source in ('paste', 'upload')),
  file_name          text,
  content_hash       text not null,
  content            text not null,
  speaker_map        jsonb,
  transcript_date    date,
  consent_confirmed  boolean not null default false,
  -- automatic drafting: status, error and the coach-only review output
  -- (source excerpts and things to check). Never shown to the member.
  ai_status          text not null default 'none' check (ai_status in ('none', 'processing', 'done', 'failed')),
  ai_error           text,
  ai_output          jsonb,
  ai_started_at      timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (session_id, content_hash)
);
alter table public.session_transcripts enable row level security;
create policy "session_transcripts: author or assigned coach" on public.session_transcripts for all
  using (created_by = auth.uid() or public.is_assigned_coach(client_id))
  with check (created_by = auth.uid() and public.is_my_client(client_id));

-- Session summaries (revisions) --------------------------------------------
-- draft -> approved -> published. Editing an approved draft returns it to
-- draft. A published revision is frozen; further edits go into a new draft
-- revision, and the member keeps seeing the published one until the next
-- publish (which marks the old one superseded).
create table if not exists public.session_summaries (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.coaching_sessions(id) on delete cascade,
  client_id         uuid not null references public.profiles(id) on delete cascade,
  revision          integer not null,
  status            text not null default 'draft' check (status in ('draft', 'approved', 'published', 'superseded')),
  content           jsonb not null default '{}'::jsonb,
  source            jsonb,
  generated_by      text not null default 'manual' check (generated_by in ('manual', 'ai')),
  version           integer not null default 1,
  approved_by       uuid references public.profiles(id) on delete set null,
  approved_at       timestamptz,
  approved_version  integer,
  published_by      uuid references public.profiles(id) on delete set null,
  published_at      timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (session_id, revision)
);
alter table public.session_summaries enable row level security;
create policy "session_summaries: staff" on public.session_summaries for all
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
create policy "session_summaries: member reads published" on public.session_summaries for select
  using (client_id = auth.uid() and status = 'published');

create or replace function public.session_summaries_guard()
returns trigger
language plpgsql
as $$
begin
  if new.client_id is distinct from old.client_id or new.session_id is distinct from old.session_id or new.revision is distinct from old.revision then
    raise exception 'A summary can''t move to another session';
  end if;
  -- Published and superseded revisions are frozen (only published -> superseded).
  if old.status in ('published', 'superseded') then
    if not (old.status = 'published' and new.status = 'superseded' and new.content = old.content) then
      raise exception 'A published summary can''t be changed; edit a new draft instead';
    end if;
    return new;
  end if;
  -- Any change to the wording counts as a new version and clears approval.
  if new.content is distinct from old.content then
    new.version = old.version + 1;
    if new.status = 'approved' then
      new.status = 'draft';
    end if;
    new.approved_by = null;
    new.approved_at = null;
    new.approved_version = null;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger session_summaries_guard before update on public.session_summaries
  for each row execute function public.session_summaries_guard();

-- Commitments and member updates -------------------------------------------
create table if not exists public.session_commitments (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  session_id         uuid not null references public.coaching_sessions(id) on delete cascade,
  summary_id         uuid not null references public.session_summaries(id) on delete cascade,
  position           integer not null,
  owner              text not null check (owner in ('client', 'coach')),
  body               text not null,
  goal_id            uuid references public.goals(id) on delete set null,
  due_date           date,
  visible_to_client  boolean not null default true,
  status             text not null default 'open' check (status in ('open', 'done', 'dropped')),
  created_at         timestamptz not null default now(),
  unique (summary_id, position)
);
alter table public.session_commitments enable row level security;
create policy "session_commitments: staff" on public.session_commitments for all
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
create policy "session_commitments: member reads own" on public.session_commitments for select
  using (client_id = auth.uid() and visible_to_client);

create table if not exists public.commitment_updates (
  id                 uuid primary key default gen_random_uuid(),
  commitment_id      uuid not null references public.session_commitments(id) on delete cascade,
  client_id          uuid not null references public.profiles(id) on delete cascade,
  author_id          uuid not null references public.profiles(id) on delete cascade,
  progress           text not null check (progress in ('tried', 'partly', 'done', 'not_yet')),
  note               text,
  support_requested  boolean not null default false,
  created_at         timestamptz not null default now()
);
alter table public.commitment_updates enable row level security;
create policy "commitment_updates: member own" on public.commitment_updates for all
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid() and author_id = auth.uid()
    and exists (select 1 from public.session_commitments c
                where c.id = commitment_id and c.client_id = auth.uid() and c.visible_to_client)
  );
create policy "commitment_updates: staff read" on public.commitment_updates for select
  using (public.is_my_client(client_id));

-- Member preparation -------------------------------------------------------
-- Drafts are private to the member. Sharing copies the text into
-- prep_shares, which the coach can read.
create table if not exists public.prep_drafts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid references public.coaching_sessions(id) on delete cascade,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique (client_id, session_id)
);
alter table public.prep_drafts enable row level security;
create policy "prep_drafts: member own" on public.prep_drafts for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

create table if not exists public.prep_shares (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid references public.coaching_sessions(id) on delete cascade,
  content     text not null,
  shared_at   timestamptz not null default now()
);
alter table public.prep_shares enable row level security;
create policy "prep_shares: member own" on public.prep_shares for all
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and (session_id is null or exists (select 1 from public.coaching_sessions s where s.id = session_id and s.client_id = auth.uid()))
  );
create policy "prep_shares: staff read" on public.prep_shares for select
  using (public.is_my_client(client_id));

-- Audit trail (no raw sensitive content) -----------------------------------
create table if not exists public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  client_id    uuid references public.profiles(id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    uuid,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create policy "audit_events: staff write own" on public.audit_events for insert
  with check (actor_id = auth.uid() and (client_id is null or public.is_my_client(client_id)));
create policy "audit_events: admin read" on public.audit_events for select using (public.is_admin());

-- Publish a summary --------------------------------------------------------
-- One transaction: the approved revision becomes the shared one, any earlier
-- shared revision is superseded, and its commitments are created exactly
-- once. Fails unless the current wording is the approved wording.
create or replace function public.publish_session_summary(p_summary_id uuid, p_expected_version integer)
returns integer
language plpgsql
security invoker set search_path = public
as $$
declare
  s public.session_summaries%rowtype;
  item jsonb;
  pos integer := 0;
begin
  select * into s from public.session_summaries where id = p_summary_id for update;
  if not found then raise exception 'Summary not found'; end if;
  if not public.is_my_client(s.client_id) then raise exception 'Not your client'; end if;
  if s.status = 'published' then return s.revision; end if; -- already done (safe retry)
  if s.status <> 'approved' or s.approved_version is distinct from s.version or s.version <> p_expected_version then
    raise exception 'Approve the latest wording before publishing';
  end if;

  update public.session_summaries set status = 'superseded'
   where session_id = s.session_id and status = 'published' and id <> s.id;

  update public.session_summaries
     set status = 'published', published_at = now(), published_by = auth.uid()
   where id = s.id;

  for item in select * from jsonb_array_elements(coalesce(s.content -> 'client_actions', '[]'::jsonb)) loop
    pos := pos + 1;
    insert into public.session_commitments (client_id, session_id, summary_id, position, owner, body, goal_id, due_date, visible_to_client)
    values (
      s.client_id, s.session_id, s.id, pos, 'client', item ->> 'text',
      (select g.id from public.goals g where g.id = nullif(item ->> 'goal_id', '')::uuid and g.client_id = s.client_id),
      nullif(item ->> 'due_date', '')::date, true
    )
    on conflict (summary_id, position) do nothing;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(s.content -> 'coach_actions', '[]'::jsonb)) loop
    pos := pos + 1;
    insert into public.session_commitments (client_id, session_id, summary_id, position, owner, body, goal_id, due_date, visible_to_client)
    values (
      s.client_id, s.session_id, s.id, pos, 'coach', item ->> 'text', null,
      nullif(item ->> 'due_date', '')::date, coalesce((item ->> 'visible')::boolean, true)
    )
    on conflict (summary_id, position) do nothing;
  end loop;

  insert into public.audit_events (actor_id, client_id, action, target_type, target_id, detail)
  values (auth.uid(), s.client_id, 'summary.published', 'session_summary', s.id, jsonb_build_object('revision', s.revision));

  return s.revision;
end;
$$;
revoke all on function public.publish_session_summary(uuid, integer) from public, anon;
grant execute on function public.publish_session_summary(uuid, integer) to authenticated;
