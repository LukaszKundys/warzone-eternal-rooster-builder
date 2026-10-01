-- Share a list by link. A list is shared while share_id is set; the owner sets it (any random uuid)
-- or clears it through the existing update policy. Clearing it kills the link.

alter table public.lists add column if not exists share_id uuid unique;

-- Anyone with the link reads one list through this function. There is deliberately no select
-- policy for shared rows: that would let anyone list every shared list instead of just opening a
-- link. Returns no row when the id isn't a currently shared list. Exposes the owner's display name,
-- never their email or user id.
create or replace function public.get_shared_list(p_share_id uuid)
returns table (
  name text,
  faction text,
  allegiance text,
  game_size text,
  points integer,
  points_limit integer,
  unit_count integer,
  roster jsonb,
  updated_at timestamptz,
  owner_name text
)
language sql stable security definer set search_path = '' as $$
  select l.name, l.faction, l.allegiance, l.game_size, l.points, l.points_limit, l.unit_count, l.roster, l.updated_at,
         coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', '') as owner_name
  from public.lists l
  join auth.users u on u.id = l.user_id
  where p_share_id is not null and l.share_id = p_share_id;
$$;

revoke all on function public.get_shared_list(uuid) from public;
grant execute on function public.get_shared_list(uuid) to anon, authenticated;
