-- Waypoint on its own: the app's documents, the same shape as the database it has inside Claude.
-- A document lives at a path ("data/users/<uid>/trips/t/<id>", "shared/<code>", "photos/italy-rome"); its
-- collection is the path without its last part.
create table public.docs (
  path text primary key check (length(path) between 3 and 600),
  parent text not null,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index docs_parent_updated on public.docs (parent, updated_at);

-- whose path is it: data/users/<uid>/... belongs to that user only; everything else is shared among signed-in people
create or replace function public.docs_path_ok(p text) returns boolean
language sql stable set search_path = '' as $$
  select case when p like 'data/users/%'
              then split_part(p, '/', 3) = (select auth.uid())::text
              else true end
$$;

alter table public.docs enable row level security;
create policy "read own and shared" on public.docs for select to authenticated
  using (public.docs_path_ok(path));
create policy "write own and shared" on public.docs for insert to authenticated
  with check (owner = (select auth.uid()) and public.docs_path_ok(path));
create policy "change what you wrote" on public.docs for update to authenticated
  using (owner = (select auth.uid()) and public.docs_path_ok(path))
  with check (owner = (select auth.uid()) and public.docs_path_ok(path));
create policy "delete what you wrote" on public.docs for delete to authenticated
  using (owner = (select auth.uid()) and public.docs_path_ok(path));

-- keep parent and the time in step with the path, whatever the app sends
create or replace function public.docs_fill() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.parent := regexp_replace(new.path, '/[^/]*$', '');
  new.updated_at := now();
  return new;
end $$;
create trigger docs_fill before insert or update on public.docs for each row execute function public.docs_fill();

-- Claude requests per person per day (written only by the claude function, which runs with the service key)
create table public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.usage enable row level security;
create policy "see your own use" on public.usage for select to authenticated using (user_id = (select auth.uid()));

-- who may have an account: only these emails can sign up
create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;   -- no policies: nobody reads it from the app

create or replace function public.only_allowed_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'This email has not been invited to Waypoint.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger only_allowed_emails before insert on auth.users for each row execute function public.only_allowed_emails();
