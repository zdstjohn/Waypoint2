-- the sign-up check runs as the database owner: nobody may call it through the API (the trigger still runs it)
revoke execute on function public.only_allowed_emails() from public, anon, authenticated;
revoke execute on function public.docs_fill() from public, anon, authenticated;
comment on table public.allowed_emails is 'Emails that may create a Waypoint account. Add one with: insert into public.allowed_emails (email) values (''name@example.com'');';
