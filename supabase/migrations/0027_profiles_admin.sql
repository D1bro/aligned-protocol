-- 0027_profiles_admin.sql
-- Coach basics and client admin (Duane, 9 Nov 2026). Nothing existing is
-- changed or removed.
--
-- coach_public          a coach's photo, short bio, credentials and meeting
--                       defaults. Read and written by the coach; read by
--                       admins. Clients see only their own coach's name,
--                       photo, bio and credentials, through my_coach().
--                       (Name, phone and time zone stay on profiles.)
-- storage coach-photos  public images (they're shown to clients); 2 MB,
--                       JPEG/PNG/WebP; a coach adds and removes only their
--                       own folder ({their id}/…).
-- client_records        a client's status (active, paused, former), when
--                       coaching started and how they found you. For admins
--                       and the client's coach.
-- client_admin_notes    admin-only notes about a client, separate from
--                       coaching notes.
-- staff_save_client_details()
--                       lets an admin or the client's coach update the
--                       client's name and contact details on their behalf.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

create table if not exists public.coach_public (
  coach_id         uuid primary key references public.profiles(id) on delete cascade,
  photo_path       text check (length(photo_path) <= 200),
  bio              text not null default '' check (length(bio) <= 1500),
  credentials      text not null default '' check (length(credentials) <= 1000),
  meeting_link     text check (meeting_link is null or (length(meeting_link) <= 500 and meeting_link ~ '^https://')),
  default_minutes  integer not null default 60 check (default_minutes between 15 and 240),
  updated_at       timestamptz not null default now()
);
alter table public.coach_public enable row level security;
revoke all on public.coach_public from public, anon;
grant select, insert, update, delete on public.coach_public to authenticated;
drop policy if exists "coach_public: the coach, and admins read" on public.coach_public;
create policy "coach_public: the coach, and admins read" on public.coach_public for select to authenticated
  using (coach_id = auth.uid() or public.is_admin());
drop policy if exists "coach_public: the coach writes their own" on public.coach_public;
create policy "coach_public: the coach writes their own" on public.coach_public for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
drop trigger if exists coach_public_updated_at on public.coach_public;
create trigger coach_public_updated_at before update on public.coach_public for each row execute function public.set_updated_at();

-- What a member sees about their own coach.
create or replace function public.my_coach()
returns table (full_name text, photo_path text, bio text, credentials text)
language sql
stable
security definer set search_path = public
as $$
  select c.full_name, cp.photo_path, coalesce(cp.bio, ''), coalesce(cp.credentials, '')
  from public.profiles me
  join public.profiles c on c.id = me.coach_id
  left join public.coach_public cp on cp.coach_id = c.id
  where me.id = auth.uid();
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-photos', 'coach-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "coach-photos: coach adds to own folder" on storage.objects;
create policy "coach-photos: coach adds to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-photos' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coach', 'admin')));
drop policy if exists "coach-photos: coach reads own folder" on storage.objects;
create policy "coach-photos: coach reads own folder" on storage.objects for select to authenticated
  using (bucket_id = 'coach-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "coach-photos: coach removes from own folder" on storage.objects;
create policy "coach-photos: coach removes from own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'coach-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.client_records (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'paused', 'former')),
  started_on  date,
  source      text check (length(source) <= 200),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);
alter table public.client_records enable row level security;
revoke all on public.client_records from public, anon;
grant select, insert, update, delete on public.client_records to authenticated;
drop policy if exists "client_records: admins and the client's coach" on public.client_records;
create policy "client_records: admins and the client's coach" on public.client_records for all to authenticated
  using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
drop trigger if exists client_records_updated_at on public.client_records;
create trigger client_records_updated_at before update on public.client_records for each row execute function public.set_updated_at();

create table if not exists public.client_admin_notes (
  client_id   uuid primary key references public.profiles(id) on delete cascade,
  notes       text not null default '' check (length(notes) <= 4000),
  updated_at  timestamptz not null default now()
);
alter table public.client_admin_notes enable row level security;
revoke all on public.client_admin_notes from public, anon;
grant select, insert, update, delete on public.client_admin_notes to authenticated;
drop policy if exists "client_admin_notes: admins only" on public.client_admin_notes;
create policy "client_admin_notes: admins only" on public.client_admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop trigger if exists client_admin_notes_updated_at on public.client_admin_notes;
create trigger client_admin_notes_updated_at before update on public.client_admin_notes for each row execute function public.set_updated_at();

-- An admin or the client's coach updates the client's name and contact
-- details for them. Only these fields; the profile's own length rules apply.
create or replace function public.staff_save_client_details(
  p_client uuid, p_full_name text, p_preferred_name text, p_phone text, p_town text, p_country text, p_timezone text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')) or not public.is_my_client(p_client) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'A name is needed';
  end if;
  update public.profiles set
    full_name = trim(p_full_name),
    preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    town = nullif(trim(coalesce(p_town, '')), ''),
    country = nullif(trim(coalesce(p_country, '')), ''),
    timezone = nullif(trim(coalesce(p_timezone, '')), '')
  where id = p_client and role = 'client';
end;
$$;
revoke all on function public.staff_save_client_details(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.staff_save_client_details(uuid, text, text, text, text, text, text) to authenticated;
