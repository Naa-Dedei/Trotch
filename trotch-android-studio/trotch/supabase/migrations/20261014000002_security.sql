-- Trotch security: role helpers and Row Level Security policies.
--
-- Model:
--   * Public network data (cities, sources, locations, stops, routes, fares) is readable by everyone,
--     including anonymous users, but writable only by staff (role 'admin' or 'editor').
--   * Users' private data is visible and writable only by its owner.
--   * Reports can be filed by signed-in users, read by their author and staff, and reviewed only by staff.
--   * Roles live in public.user_roles and can only be granted with the service role or the SQL editor.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can read user_roles regardless of caller's RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_network_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'editor')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_network_editor() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_network_editor() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Trigger-only functions must not be callable through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.trim_recent_searches() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.cities enable row level security;
alter table public.data_sources enable row level security;
alter table public.locations enable row level security;
alter table public.location_aliases enable row level security;
alter table public.stops enable row level security;
alter table public.stop_aliases enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.fares enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.saved_places enable row level security;
alter table public.saved_routes enable row level security;
alter table public.saved_journeys enable row level security;
alter table public.recent_searches enable row level security;
alter table public.route_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Public network data: read for all, write for staff only
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'cities', 'data_sources', 'locations', 'location_aliases', 'stops', 'stop_aliases', 'routes', 'route_stops', 'fares'
  ]
  loop
    execute format('create policy "Public can read %1$s" on public.%1$I for select to anon, authenticated using (true);', t);
    execute format('create policy "Staff can insert %1$s" on public.%1$I for insert to authenticated with check ((select public.is_network_editor()));', t);
    execute format('create policy "Staff can update %1$s" on public.%1$I for update to authenticated using ((select public.is_network_editor())) with check ((select public.is_network_editor()));', t);
    execute format('create policy "Staff can delete %1$s" on public.%1$I for delete to authenticated using ((select public.is_network_editor()));', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Roles: users may see their own roles (so the app can show the admin entry point).
-- There are deliberately NO insert/update/delete policies, and table privileges are revoked too.
-- ---------------------------------------------------------------------------
create policy "Users read own roles" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private user data: owner only
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['saved_places', 'saved_routes', 'saved_journeys', 'recent_searches']
  loop
    execute format('create policy "Owner can read %1$s" on public.%1$I for select to authenticated using (user_id = (select auth.uid()));', t);
    execute format('create policy "Owner can insert %1$s" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()));', t);
    execute format('create policy "Owner can update %1$s" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));', t);
    execute format('create policy "Owner can delete %1$s" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()));', t);
  end loop;
end;
$$;
revoke all on public.saved_places, public.saved_routes, public.saved_journeys, public.recent_searches from anon;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create policy "Users file reports as themselves" on public.route_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'open'
    and reviewer_id is null
    and reviewer_notes is null
    and reviewed_at is null
  );
create policy "Authors and staff read reports" on public.route_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_network_editor()));
create policy "Staff review reports" on public.route_reports
  for update to authenticated
  using ((select public.is_network_editor()))
  with check ((select public.is_network_editor()));
create policy "Admins delete reports" on public.route_reports
  for delete to authenticated
  using ((select public.is_admin()));
revoke all on public.route_reports from anon;
