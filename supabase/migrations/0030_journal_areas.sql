-- 0030_journal_areas.sql
-- The journal by life area (Duane, 10 Nov 2026): write freely, or write in
-- the section for one of the ten areas of your chart ("today I want to write
-- about relationships"). Entries stay private to the writer, as before.
--
-- journal_entries.life_area_id   the area an entry is written in, or null for
--                                free writing. Existing entries stay as free
--                                writing; nothing is changed or removed.
--
-- Run in the Supabase SQL Editor (test first, then live) before deploying the
-- matching app change. Safe to run more than once.

alter table public.journal_entries add column if not exists life_area_id uuid references public.life_areas(id) on delete set null;
create index if not exists journal_entries_area_idx on public.journal_entries (client_id, life_area_id, entry_date desc);
