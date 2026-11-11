-- Journey fixes (Duane, 11 Nov 2026).
--
-- 1. The weekly check-in email becomes opt-in.
-- 2. Films: a link per film slot, pasted in Console → Films. A slot with no
--    link (and no film in the site's own folder) shows nothing.

-- 1. The weekly check-in email is opt-in. New
-- profiles start with it off unless the sign-up form's box was ticked
-- (passed as reminders_email in the account's metadata). Guests who save
-- their work set it directly on their existing profile. Existing members
-- keep whatever they have now.
alter table public.profiles alter column reminders_email set default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, reminders_email)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'client',
    coalesce(new.raw_user_meta_data ->> 'reminders_email', 'false') = 'true'
  );
  return new;
end;
$$;

-- 2. Film links. Readable by everyone (they're shown on public pages);
-- only admins change them.
create table if not exists public.film_links (
  slot text primary key check (slot ~ '^[A-Za-z0-9-]{2,40}$'),
  url text not null check (url ~ '^https://' and length(url) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.film_links enable row level security;
drop policy if exists "film_links: everyone reads" on public.film_links;
create policy "film_links: everyone reads" on public.film_links for select using (true);
drop policy if exists "film_links: admin writes" on public.film_links;
create policy "film_links: admin writes" on public.film_links for all using (public.is_admin()) with check (public.is_admin());
grant select on public.film_links to anon, authenticated;
grant insert, update, delete on public.film_links to authenticated;
