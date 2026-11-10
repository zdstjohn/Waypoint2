-- one more Claude request for this person today, if they are under the limit: returns today's count, or -1 when over.
-- Only the claude function (service key) may call it.
create or replace function public.bump_usage(uid uuid, lim integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare cur integer;
begin
  insert into public.usage (user_id, day, n) values (uid, current_date, 0) on conflict (user_id, day) do nothing;
  update public.usage set n = n + 1 where user_id = uid and day = current_date and n < lim returning n into cur;
  return coalesce(cur, -1);
end $$;
revoke execute on function public.bump_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_usage(uuid, integer) to service_role;
