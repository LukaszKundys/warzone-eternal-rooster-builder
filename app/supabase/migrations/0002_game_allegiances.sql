-- Use the game's allegiances instead of the placeholder Loyalist / Rebel from the account-flows design.
-- Existing rows are mapped: Loyalist → agents_of_light, Rebel → servants_of_darkness.

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
