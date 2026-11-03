-- 0025_journal_connected.sql
-- Phase 5 of the build clarifications (3 Nov 2026): one connected journal.
-- Existing entries are untouched; the new fields are optional. Who can write
-- is unchanged (Aligned Practice and Momentum, journal_entries' policy), and
-- the journal stays private: no coach or admin access.
--
-- journal_entries.goal_id    the goal an entry is about, if any (their own).
-- journal_entries.video_url  one link to a video, shown as a link card.
-- journal_entries.images     up to 4 storage paths in the private 'journal'
--                            bucket, each under the member's own folder.
-- storage 'journal'          private; 5 MB per image; JPEG, PNG or WebP.
--                            Members upload to and read only their own
--                            folder ({their id}/…).
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

alter table public.journal_entries add column if not exists goal_id uuid references public.goals(id) on delete set null;
alter table public.journal_entries add column if not exists video_url text;
alter table public.journal_entries add column if not exists images text[] not null default '{}';
alter table public.journal_entries drop constraint if exists journal_entries_video_url_check;
alter table public.journal_entries add constraint journal_entries_video_url_check
  check (video_url is null or (length(video_url) <= 500 and video_url ~ '^https://'));
alter table public.journal_entries drop constraint if exists journal_entries_images_check;
alter table public.journal_entries add constraint journal_entries_images_check check (cardinality(images) <= 4);

-- Restrictive, so it applies on top of the member's own policy: a linked
-- goal and every image must be theirs.
drop policy if exists "journal: links stay within their own things" on public.journal_entries;
create policy "journal: links stay within their own things" on public.journal_entries as restrictive for all to authenticated
  using (true)
  with check (
    (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.client_id = auth.uid()))
    and not exists (select 1 from unnest(images) as p where p not like auth.uid()::text || '/%')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "journal bucket: member adds to own folder" on storage.objects;
create policy "journal bucket: member adds to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text and public.alignment_is_member());
drop policy if exists "journal bucket: member reads own folder" on storage.objects;
create policy "journal bucket: member reads own folder" on storage.objects for select to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "journal bucket: member removes from own folder" on storage.objects;
create policy "journal bucket: member removes from own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
-- Deliberately no coach or admin policy: the journal is private.
