-- Private readings (texts split into words with pinyin, meanings and
-- translations). Run once in Supabase → SQL Editor, after schema.sql.
--
-- The texts can come from copyrighted textbooks, so they never go in the
-- repository: they live here, and the policies only let each user read and
-- write their own rows.

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book text not null,
  unit text not null,
  position integer,
  title text not null,
  title_translation text not null,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, book, unit, title)
);

alter table public.readings enable row level security;

create policy "Read own readings" on public.readings
  for select using ((select auth.uid()) = user_id);

create policy "Insert own readings" on public.readings
  for insert with check ((select auth.uid()) = user_id);

create policy "Update own readings" on public.readings
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Delete own readings" on public.readings
  for delete using ((select auth.uid()) = user_id);
