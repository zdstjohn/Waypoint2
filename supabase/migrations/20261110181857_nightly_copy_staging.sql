-- The nightly copy from the Claude version: a staging table that the public key can add to only while a short
-- window is open, and a function (callable only from the dashboard/connector) that moves rows into docs
-- when their combined fingerprint matches the one the copying task computed from what it read.
-- (The next migration moves import_open into the private schema.)
create table if not exists public.import_window (id int primary key default 1 check (id = 1), open_until timestamptz not null default now());
insert into public.import_window (id) values (1) on conflict do nothing;
alter table public.import_window enable row level security;

create table if not exists public.import_staging (
  path text not null,
  body text not null,
  at timestamptz not null default now()
);
alter table public.import_staging enable row level security;

create or replace function public.import_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.import_window where open_until > now())
$$;
revoke all on function public.import_open() from public;
grant execute on function public.import_open() to anon;

create policy import_staging_add on public.import_staging for insert to anon
  with check (
    public.import_open()
    and path ~ '^(photos|places|menus|morefood|links|fx)/[A-Za-z0-9_.:@+~-]{1,200}$'
    and length(body) < 300000
  );
revoke all on public.import_staging from anon, authenticated;
grant insert (path, body) on public.import_staging to anon;
revoke all on public.import_window from anon, authenticated;

-- Opens the window for some minutes and clears anything left over.
create or replace function public.import_begin(minutes int default 10) returns timestamptz
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.import_staging;
  update public.import_window set open_until = now() + make_interval(mins => least(greatest(minutes, 1), 30)) where id = 1;
  return (select open_until from public.import_window where id = 1);
end $$;

-- Closes the window; if the staged rows match the fingerprint, copies them in (new or changed only, never a row
-- someone owns) and returns how many were written. Always empties staging.
create or replace function public.import_finish(want text, expect_count int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare got text; n int; written int := 0;
begin
  update public.import_window set open_until = now() where id = 1;
  select count(*), md5(coalesce(string_agg(path || E'\t' || md5(body), E'\n' order by path collate "C"), ''))
    into n, got from public.import_staging;
  if n <> expect_count or got <> want then
    delete from public.import_staging;
    return jsonb_build_object('ok', false, 'staged', n, 'reason', 'fingerprint did not match; nothing copied');
  end if;
  with up as (
    insert into public.docs (path, data, owner)
    select path, body::jsonb, null from public.import_staging
    on conflict (path) do update set data = excluded.data
      where public.docs.owner is null and public.docs.data is distinct from excluded.data
    returning 1
  ) select count(*) into written from up;
  delete from public.import_staging;
  return jsonb_build_object('ok', true, 'staged', n, 'written', written);
end $$;
revoke all on function public.import_begin(int) from public, anon, authenticated;
revoke all on function public.import_finish(text, int) from public, anon, authenticated;
