-- The nightly copy may also bring the city library (citylib/<place>, v185).
alter policy import_staging_add on public.import_staging
  with check (
    private.import_open()
    and path ~ '^(photos|places|menus|morefood|links|fx|maps|citylib)/[A-Za-z0-9_.:@+~-]{1,200}$'
    and length(body) < 300000
  );
