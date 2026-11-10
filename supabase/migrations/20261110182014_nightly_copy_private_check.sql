-- the window check lives outside the API schema: the staging rule can use it, nobody can call it over the API
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon;
alter function public.import_open() set schema private;
revoke all on function private.import_open() from public, authenticated;
grant execute on function private.import_open() to anon;
