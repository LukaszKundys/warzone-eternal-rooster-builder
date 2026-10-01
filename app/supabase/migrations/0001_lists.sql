-- Saved rosters, one row per list. Each player can only see and change their own rows.
-- Apply in the Supabase dashboard (SQL Editor → paste → Run) or via the Supabase MCP / CLI.

create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  faction      text not null,
  allegiance   text not null check (allegiance in ('agents_of_light', 'servants_of_darkness')),
  game_size    text not null,
  points       integer not null default 0 check (points >= 0),
  points_limit integer not null check (points_limit > 0),
  unit_count   integer not null default 0 check (unit_count >= 0),
  roster       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lists_user_updated_idx on public.lists (user_id, updated_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

alter table public.lists enable row level security;

drop policy if exists "Players read their own lists" on public.lists;
create policy "Players read their own lists" on public.lists
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Players create their own lists" on public.lists;
create policy "Players create their own lists" on public.lists
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own lists" on public.lists;
create policy "Players update their own lists" on public.lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Players delete their own lists" on public.lists;
create policy "Players delete their own lists" on public.lists
  for delete to authenticated using ((select auth.uid()) = user_id);
