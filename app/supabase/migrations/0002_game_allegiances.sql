-- Only needed for databases set up with an earlier version of 0001_lists.sql, which allowed the
-- placeholder allegiances 'Loyalist' and 'Rebel'. Safe to run on a fresh database: it changes nothing.
-- Old rows are mapped: Loyalist → agents_of_light, Rebel → servants_of_darkness.

alter table public.lists drop constraint if exists lists_allegiance_check;

update public.lists
set allegiance = case allegiance
  when 'Loyalist' then 'agents_of_light'
  when 'Rebel' then 'servants_of_darkness'
  else allegiance
end
where allegiance in ('Loyalist', 'Rebel');

alter table public.lists
  add constraint lists_allegiance_check check (allegiance in ('agents_of_light', 'servants_of_darkness'));
