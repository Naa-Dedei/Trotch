-- Grant a Trotch staff role. Run in the Supabase SQL editor (or psql as the postgres/service role).
-- The app can never do this itself: there is no client policy that allows writing to user_roles.
--
--   admin  : edit network data, review reports, delete reports
--   editor : edit network data, review reports
--
-- 1. The person signs up in the app first.
-- 2. Replace the email below and run this script.

insert into public.user_roles (user_id, role, granted_by)
select id, 'admin', 'sql-editor'
from auth.users
where email = 'replace-me@example.com'
on conflict (user_id, role) do nothing;

-- Revoke:
-- delete from public.user_roles
-- where role = 'admin' and user_id = (select id from auth.users where email = 'replace-me@example.com');
