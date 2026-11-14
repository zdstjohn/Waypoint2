-- The nightly copy may also bring the world library's records (world/<country-city>, v196): a destination's checked
-- hours, entry rules, pins and walks. Written only by the copy (public.import_finish); any signed-in person reads them.
alter policy import_staging_add on public.import_staging
  with check (
    private.import_open()
    and path ~ '^(photos|places|menus|morefood|links|fx|maps|citylib|world)/[A-Za-z0-9_.:@+~-]{1,200}$'
    and length(body) < 300000
  );
