-- Lets a signed-in player delete their own account. Their lists go with it (lists.user_id cascades).
-- Browsers can't delete auth users directly, so this runs as the function owner. It only ever
-- deletes the caller (auth.uid()); signed-out callers are rejected.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
