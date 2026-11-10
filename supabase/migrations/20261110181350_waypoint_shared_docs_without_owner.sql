-- shared idea data copied in each night (photos, place checks, restaurants, menus, links, exchange rates) belongs to
-- nobody: it has no owner, so no signed-in person can change or remove it (the update and delete rules need owner = you)
alter table public.docs alter column owner drop not null;
comment on column public.docs.owner is 'Who wrote it. Empty for the shared data the nightly copy brings in (written only by public.import_finish).';
