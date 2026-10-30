-- Trotch core schema: transport network, users' private data, reports and roles.
-- Spatial columns use PostGIS (installed in the `extensions` schema, as on Supabase).

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.transport_mode as enum ('trotro', 'shared_taxi', 'bus', 'intercity_bus');
create type public.stop_kind as enum ('terminal', 'station', 'roadside', 'landmark');
create type public.location_kind as enum ('neighbourhood', 'landmark', 'terminal', 'institution', 'market', 'junction');
create type public.verification_status as enum ('verified', 'community_reported', 'unverified', 'outdated', 'inactive');
create type public.source_kind as enum ('field_survey', 'operator', 'official', 'community', 'demo');
create type public.report_type as enum ('stop_location', 'route_info', 'fare_change', 'missing_route', 'other');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'rejected');
create type public.app_role as enum ('admin', 'editor');
create type public.saved_place_kind as enum ('home', 'school', 'work', 'custom');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Records which signed-in user last changed an official network record.
create or replace function public.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.cities (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  region text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  kind public.source_kind not null,
  url text check (url is null or url ~* '^https?://'),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Searchable places (neighbourhoods, landmarks, institutions)
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities (id),
  name text not null check (char_length(name) between 2 and 120),
  kind public.location_kind not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  description text check (description is null or char_length(description) <= 500),
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index locations_geog_idx on public.locations using gist (geog);
create index locations_city_idx on public.locations (city_id);
create index locations_name_idx on public.locations (lower(name));

create table public.location_aliases (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 120)
);
create unique index location_aliases_unique on public.location_aliases (location_id, lower(alias));
create index location_aliases_alias_idx on public.location_aliases (lower(alias));

-- ---------------------------------------------------------------------------
-- Stops: formal terminals, informal roadside points, landmark stops
-- ---------------------------------------------------------------------------
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities (id),
  name text not null check (char_length(name) between 2 and 120),
  kind public.stop_kind not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  landmark_hint text check (landmark_hint is null or char_length(landmark_hint) <= 300),
  verification_status public.verification_status not null default 'unverified',
  source_id uuid references public.data_sources (id) on delete set null,
  last_verified_at timestamptz,
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index stops_geog_idx on public.stops using gist (geog);
create index stops_city_idx on public.stops (city_id);
create index stops_name_idx on public.stops (lower(name));

create table public.stop_aliases (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops (id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 120)
);
create unique index stop_aliases_unique on public.stop_aliases (stop_id, lower(alias));
create index stop_aliases_alias_idx on public.stop_aliases (lower(alias));

-- ---------------------------------------------------------------------------
-- Routes. Directional: a reverse service is a separate route row.
-- ---------------------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities (id),
  code text check (code is null or char_length(code) between 1 and 20), -- many trotro routes have no number
  name text not null check (char_length(name) between 2 and 120),
  mode public.transport_mode not null,
  headsign text not null check (char_length(headsign) between 1 and 80),
  call_out text check (call_out is null or char_length(call_out) <= 80),
  typical_wait_min smallint check (typical_wait_min is null or typical_wait_min between 0 and 240),
  path_geojson jsonb check (
    path_geojson is null
    or (path_geojson ->> 'type' = 'LineString' and jsonb_typeof(path_geojson -> 'coordinates') = 'array')
  ),
  verification_status public.verification_status not null default 'unverified',
  source_id uuid references public.data_sources (id) on delete set null,
  last_verified_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 1000),
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index routes_city_idx on public.routes (city_id);
create index routes_mode_idx on public.routes (mode);

create table public.route_stops (
  route_id uuid not null references public.routes (id) on delete cascade,
  seq integer not null check (seq >= 0),
  stop_id uuid not null references public.stops (id) on delete restrict,
  minutes_from_previous numeric(6, 1) check (minutes_from_previous is null or minutes_from_previous >= 0),
  primary key (route_id, seq),
  constraint first_stop_has_no_previous check (seq > 0 or minutes_from_previous is null)
);
create index route_stops_stop_idx on public.route_stops (stop_id);

-- ---------------------------------------------------------------------------
-- Fares (GHS). A NULL from/to pair = flat whole-route fare.
-- ---------------------------------------------------------------------------
create table public.fares (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  from_stop_id uuid references public.stops (id) on delete cascade,
  to_stop_id uuid references public.stops (id) on delete cascade,
  min_ghs numeric(10, 2) not null check (min_ghs >= 0),
  max_ghs numeric(10, 2) not null,
  currency char(3) not null default 'GHS' check (currency = 'GHS'),
  effective_from date,
  effective_to date,
  verification_status public.verification_status not null default 'unverified',
  source_id uuid references public.data_sources (id) on delete set null,
  last_verified_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint fare_range check (max_ghs >= min_ghs),
  constraint fare_segment_pair check ((from_stop_id is null) = (to_stop_id is null)),
  constraint fare_segment_distinct check (from_stop_id is null or from_stop_id <> to_stop_id),
  constraint fare_dates check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create index fares_route_idx on public.fares (route_id);

-- A segment fare must follow the route's direction: boarding stop before alighting stop.
create or replace function public.validate_fare_segment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  from_seq integer;
  to_seq integer;
begin
  if new.from_stop_id is null then
    return new;
  end if;
  select min(seq) into from_seq from public.route_stops where route_id = new.route_id and stop_id = new.from_stop_id;
  select max(seq) into to_seq from public.route_stops where route_id = new.route_id and stop_id = new.to_stop_id;
  if from_seq is null or to_seq is null then
    raise exception 'Fare stops must both be on route %', new.route_id using errcode = '23514';
  end if;
  if from_seq >= to_seq then
    raise exception 'Fare boarding stop must come before alighting stop on route %', new.route_id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger fares_validate_segment
  before insert or update on public.fares
  for each row execute function public.validate_fare_segment();

-- ---------------------------------------------------------------------------
-- Users: profiles and protected roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles can only be granted with the service role / SQL editor. No client policy allows writes.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by text,
  primary key (user_id, role)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), 60), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Users' private data
-- ---------------------------------------------------------------------------
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.saved_place_kind not null default 'custom',
  label text not null check (char_length(label) between 1 and 60),
  place_name text not null check (char_length(place_name) between 1 and 160),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location_id uuid references public.locations (id) on delete set null,
  stop_id uuid references public.stops (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_places_user_idx on public.saved_places (user_id);
-- One home / work / school per user; any number of custom places.
create unique index saved_places_one_per_kind on public.saved_places (user_id, kind) where kind <> 'custom';

create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, route_id)
);

create table public.saved_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  origin jsonb not null,
  destination jsonb not null,
  -- Snapshot of the planned journey (legs, fares, durations) so it can be reopened offline.
  journey jsonb not null check (pg_column_size(journey) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_journeys_user_idx on public.saved_journeys (user_id, created_at desc);

create table public.recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origin jsonb not null,
  destination jsonb not null,
  created_at timestamptz not null default now(),
  -- Privacy: precise device location is never stored in search history.
  constraint recent_no_device_location check (
    coalesce(origin ->> 'type', '') <> 'current_location'
    and coalesce(destination ->> 'type', '') <> 'current_location'
  )
);
create index recent_searches_user_idx on public.recent_searches (user_id, created_at desc);

-- Keep only each user's 20 most recent searches.
create or replace function public.trim_recent_searches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recent_searches
  where user_id = new.user_id
    and id not in (
      select id from public.recent_searches where user_id = new.user_id order by created_at desc limit 20
    );
  return null;
end;
$$;

create trigger recent_searches_trim
  after insert on public.recent_searches
  for each row execute function public.trim_recent_searches();

-- ---------------------------------------------------------------------------
-- Community reports (never auto-promoted to verified)
-- ---------------------------------------------------------------------------
create table public.route_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  report_type public.report_type not null,
  route_id uuid references public.routes (id) on delete set null,
  stop_id uuid references public.stops (id) on delete set null,
  description text not null check (char_length(description) between 10 and 1000),
  suggested_min_ghs numeric(10, 2) check (suggested_min_ghs is null or suggested_min_ghs >= 0),
  suggested_max_ghs numeric(10, 2) check (suggested_max_ghs is null or suggested_max_ghs >= 0),
  suggested_lat double precision check (suggested_lat is null or suggested_lat between -90 and 90),
  suggested_lng double precision check (suggested_lng is null or suggested_lng between -180 and 180),
  journey_context jsonb,
  status public.report_status not null default 'open',
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_fare_range check (
    suggested_min_ghs is null or suggested_max_ghs is null or suggested_max_ghs >= suggested_min_ghs
  )
);
create index route_reports_status_idx on public.route_reports (status, created_at desc);
create index route_reports_user_idx on public.route_reports (user_id);

-- ---------------------------------------------------------------------------
-- updated_at / updated_by triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.data_sources for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.locations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stops for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.routes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fares for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.saved_places for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.saved_journeys for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.route_reports for each row execute function public.set_updated_at();

create trigger set_updated_by before insert or update on public.locations for each row execute function public.set_updated_by();
create trigger set_updated_by before insert or update on public.stops for each row execute function public.set_updated_by();
create trigger set_updated_by before insert or update on public.routes for each row execute function public.set_updated_by();
create trigger set_updated_by before insert or update on public.fares for each row execute function public.set_updated_by();
