-- Trotch API functions (exposed through PostgREST as RPCs).
-- All run as SECURITY INVOKER, so Row Level Security still applies to the caller.

-- ---------------------------------------------------------------------------
-- Network version: cheap check the app uses to decide whether its cached copy is stale.
-- ---------------------------------------------------------------------------
create or replace function public.network_version(p_city_id text default null)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(
    (select max(updated_at) from public.stops where p_city_id is null or city_id = p_city_id),
    (select max(updated_at) from public.routes where p_city_id is null or city_id = p_city_id),
    (select max(f.updated_at) from public.fares f join public.routes r on r.id = f.route_id
      where p_city_id is null or r.city_id = p_city_id),
    (select max(updated_at) from public.locations where p_city_id is null or city_id = p_city_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Whole-network snapshot in the app's shape, in one round trip (important on slow mobile data).
-- Inactive records are included so the app can label them; the planner skips them.
-- ---------------------------------------------------------------------------
create or replace function public.get_network(p_city_id text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'version', public.network_version(p_city_id),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ds.id, 'name', ds.name, 'kind', ds.kind, 'url', ds.url, 'isDemo', ds.is_demo))
      from public.data_sources ds), '[]'::jsonb),
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'cityId', s.city_id, 'name', s.name, 'kind', s.kind, 'lat', s.lat, 'lng', s.lng,
        'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from public.stop_aliases a where a.stop_id = s.id), '[]'::jsonb),
        'landmarkHint', s.landmark_hint, 'isActive', s.is_active,
        'quality', jsonb_build_object(
          'verification', s.verification_status, 'lastVerifiedAt', s.last_verified_at,
          'sourceId', s.source_id, 'isDemo', s.is_demo)
      ) order by s.name)
      from public.stops s where p_city_id is null or s.city_id = p_city_id), '[]'::jsonb),
    'routes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'cityId', r.city_id, 'code', r.code, 'name', r.name, 'mode', r.mode,
        'headsign', r.headsign, 'callOut', r.call_out, 'typicalWaitMin', r.typical_wait_min,
        'stops', coalesce((
          select jsonb_agg(jsonb_build_object('stopId', rs.stop_id, 'minutesFromPrevious', rs.minutes_from_previous) order by rs.seq)
          from public.route_stops rs where rs.route_id = r.id), '[]'::jsonb),
        'path', r.path_geojson -> 'coordinates',
        'isActive', r.is_active, 'notes', r.notes,
        'quality', jsonb_build_object(
          'verification', r.verification_status, 'lastVerifiedAt', r.last_verified_at,
          'sourceId', r.source_id, 'isDemo', r.is_demo)
      ) order by r.name)
      from public.routes r where p_city_id is null or r.city_id = p_city_id), '[]'::jsonb),
    'fares', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'routeId', f.route_id, 'fromStopId', f.from_stop_id, 'toStopId', f.to_stop_id,
        'minGhs', f.min_ghs, 'maxGhs', f.max_ghs,
        'effectiveFrom', f.effective_from, 'effectiveTo', f.effective_to,
        'quality', jsonb_build_object(
          'verification', f.verification_status, 'lastVerifiedAt', f.last_verified_at,
          'sourceId', f.source_id, 'isDemo', f.is_demo)
      ))
      from public.fares f join public.routes r on r.id = f.route_id
      where p_city_id is null or r.city_id = p_city_id), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'cityId', l.city_id, 'name', l.name, 'kind', l.kind, 'lat', l.lat, 'lng', l.lng,
        'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from public.location_aliases a where a.location_id = l.id), '[]'::jsonb),
        'description', l.description, 'isDemo', l.is_demo
      ) order by l.name)
      from public.locations l where l.is_active and (p_city_id is null or l.city_id = p_city_id)), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Nearby stops using the spatial index.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_stops(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 800,
  p_limit integer default 30
)
returns table (stop_id uuid, name text, kind public.stop_kind, lat double precision, lng double precision, distance_m double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name, s.kind, s.lat, s.lng,
         extensions.st_distance(s.geog, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography) as distance_m
  from public.stops s
  where s.is_active
    and extensions.st_dwithin(
          s.geog,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          least(greatest(p_radius_m, 50), 5000))
  order by distance_m
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Staff: replace a route's ordered stops atomically.
-- p_stops: [{"stopId": uuid, "minutesFromPrevious": number|null}, ...] in travel order.
-- ---------------------------------------------------------------------------
create or replace function public.replace_route_stops(p_route_id uuid, p_stops jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_network_editor() then
    raise exception 'Only network editors can change route stops' using errcode = '42501';
  end if;
  if jsonb_typeof(p_stops) <> 'array' then
    raise exception 'p_stops must be a JSON array' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_stops);
  if n < 2 then
    raise exception 'A route needs at least two stops' using errcode = '22023';
  end if;

  delete from public.route_stops where route_id = p_route_id;
  insert into public.route_stops (route_id, seq, stop_id, minutes_from_previous)
  select p_route_id,
         (e.ordinality - 1)::integer,
         (e.value ->> 'stopId')::uuid,
         case when e.ordinality = 1 then null else nullif(e.value ->> 'minutesFromPrevious', '')::numeric end
  from jsonb_array_elements(p_stops) with ordinality as e(value, ordinality);

  -- Touch the route so cached copies of the network are refreshed.
  update public.routes set updated_at = now() where id = p_route_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: review a community report. Never changes verification of network data by itself.
-- ---------------------------------------------------------------------------
create or replace function public.review_report(p_report_id uuid, p_status public.report_status, p_notes text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_network_editor() then
    raise exception 'Only network editors can review reports' using errcode = '42501';
  end if;
  update public.route_reports
     set status = p_status,
         reviewer_notes = nullif(trim(p_notes), ''),
         reviewer_id = auth.uid(),
         reviewed_at = case when p_status in ('resolved', 'rejected') then now() else null end
   where id = p_report_id;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.replace_route_stops(uuid, jsonb) from public, anon;
revoke all on function public.review_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.replace_route_stops(uuid, jsonb) to authenticated;
grant execute on function public.review_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.get_network(text) to anon, authenticated;
grant execute on function public.network_version(text) to anon, authenticated;
grant execute on function public.nearby_stops(double precision, double precision, integer, integer) to anon, authenticated;
