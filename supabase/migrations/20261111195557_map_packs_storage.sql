-- Street-map packs for the installable app, kept in this project's file storage (bucket "maps", anyone may read).
-- The nightly copy adds them while its window is open (the window the documents use), each named by its id in the
-- Claude version's file store (a rebuilt pack has a new id), so a stored pack never changes: a rebuilt one is a new
-- file. Nobody can replace or delete a stored file over the API; the window check stays outside the API schema
-- (private.import_open).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maps', 'maps', true, 20971520, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "maps: anyone may read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'maps');
create policy "maps: the nightly copy adds packs" on storage.objects for insert to anon
  with check (
    bucket_id = 'maps'
    and private.import_open()
    and name ~ '^[a-z0-9-]{1,90}/p[0-9]{1,2}-[0-9a-f]{32}\.json$'
  );

-- the staging rule takes maps/<slug> documents too (the pack list the app reads)
drop policy if exists import_staging_add on public.import_staging;
create policy import_staging_add on public.import_staging for insert to anon
  with check (
    private.import_open()
    and path ~ '^(photos|places|menus|morefood|links|fx|maps)/[A-Za-z0-9_.:@+~-]{1,200}$'
    and length(body) < 300000
  );
