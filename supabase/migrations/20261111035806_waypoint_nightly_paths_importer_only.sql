-- The shared nightly paths (photos, places, menus, morefood, links, maps, fx) are written only by the nightly copy
-- (public.import_finish). A signed-in person may write their own data (data/users/<them>/...), shared trips (shared/...)
-- and photo requests (wanted/...), and nothing else. Until now anyone invited could create a document on a nightly path
-- before the copy did, and the copy never overwrites a document someone owns (the audit's S4).
create or replace function public.docs_write_ok(p text) returns boolean
  language sql stable set search_path to ''
as $$
  select case when p like 'data/users/%' then split_part(p, '/', 3) = (select auth.uid())::text
              else (p like 'shared/%' or p like 'wanted/%') end
$$;
comment on function public.docs_write_ok(text) is 'May the signed-in person write a document at this path? Their own data, shared trips and photo requests only.';
revoke all on function public.docs_write_ok(text) from public, anon;
grant execute on function public.docs_write_ok(text) to authenticated, service_role;

drop policy "write own and shared" on public.docs;
create policy "write own data, shared trips and photo requests" on public.docs for insert to authenticated
  with check ((owner = (select auth.uid())) and public.docs_write_ok(path));

drop policy "change what you wrote" on public.docs;
create policy "change what you wrote" on public.docs for update to authenticated
  using ((owner = (select auth.uid())) and public.docs_path_ok(path))
  with check ((owner = (select auth.uid())) and public.docs_write_ok(path));
