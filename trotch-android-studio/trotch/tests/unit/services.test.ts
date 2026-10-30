import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminService, NotStaffError } from '@/features/admin/adminService';
import { clusterPoints } from '@/features/map/cluster';
import { loadNetwork, NetworkUnavailableError, type NetworkDeps } from '@/features/network/repository';
import { reportFormSchema, submitReport } from '@/features/reports/reportService';
import { planJourneys } from '@/features/routing/planner';
import { AuthRequiredError, createSavedService } from '@/features/saved/savedService';
import demo from '@/data/demo-network.json';
import type { PlaceRef, TransportNetwork } from '@/types/transport';
import { lineNetwork, near } from './fixtures';

/** Minimal in-memory stand-in for the Supabase query builder: records every call. */
function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  let seq = 0;
  const from = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const rows = (tables[table] ??= []);
    const result = () => {
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
        const inserted = list.map((r) => ({ id: `id-${++seq}`, created_at: new Date(2026, 9, seq).toISOString(), ...r }));
        rows.push(...inserted);
        return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
      }
      return { data: rows, error: null };
    };
    const b = {
      select: () => b,
      insert: (p: unknown) => ((op = 'insert'), (payload = p), calls.push({ table, op, payload: p }), b),
      update: (p: unknown) => ((op = 'update'), calls.push({ table, op, payload: p }), b),
      delete: () => ((op = 'delete'), calls.push({ table, op }), b),
      eq: () => b,
      order: () => b,
      limit: () => b,
      single: () => b,
      maybeSingle: () => b,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return b;
  };
  const client = { from, rpc: jest.fn(async () => ({ data: null, error: null })) } as unknown as SupabaseClient;
  return { client, calls, tables };
}

const network = demo as unknown as TransportNetwork;

describe('saved items require a signed-in user', () => {
  it('refuses to save or list anything when signed out', async () => {
    const { client } = fakeClient();
    const saved = createSavedService(client, null);
    expect(saved.isSignedIn).toBe(false);
    await expect(saved.listPlaces()).rejects.toBeInstanceOf(AuthRequiredError);
    await expect(saved.savePlace({ kind: 'home', label: 'Home', place: { label: 'Madina', lat: 5.67, lng: -0.16, type: 'location' } })).rejects.toThrow('Sign in to save places.');
    await expect(saved.favouriteRoute('r1')).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it('refuses when there is no backend at all', async () => {
    const saved = createSavedService(null, 'user-1');
    await expect(saved.listJourneys()).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it('saves a planned journey for the signed-in user and lists it back', async () => {
    const { client, calls } = fakeClient();
    const saved = createSavedService(client, 'user-1');
    const net = lineNetwork();
    const s = Object.fromEntries(net.stops.map((x) => [x.id, x]));
    const r = planJourneys(net, near(s.A!), near(s.D!), { today: '2026-10-14' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const id = await saved.saveJourney('Morning trip', r.journeys[0]!);
    expect(id).toMatch(/^id-/);
    expect(calls[0]).toMatchObject({ table: 'saved_journeys', op: 'insert', payload: { user_id: 'user-1', name: 'Morning trip' } });
    const list = await saved.listJourneys();
    expect(list[0]).toMatchObject({ name: 'Morning trip' });
    expect(list[0]!.journey.legs.length).toBe(3);
  });

  it('never stores device location: current-location trips are skipped and journey ends are anonymised', async () => {
    const { client, calls } = fakeClient();
    const saved = createSavedService(client, 'user-1');
    const me: PlaceRef = { label: 'My location', lat: 5.6, lng: -0.2, type: 'current_location' };
    const ug: PlaceRef = { label: 'UG', lat: 5.64, lng: -0.18, type: 'location' };
    expect(await saved.addRecent(me, ug)).toBe(false);
    expect(calls).toHaveLength(0);

    const net = lineNetwork();
    const s = Object.fromEntries(net.stops.map((x) => [x.id, x]));
    const r = planJourneys(net, { ...near(s.A!), type: 'current_location', label: 'My location' }, near(s.D!), { today: '2026-10-14' });
    if (r.status !== 'ok') throw new Error('expected ok');
    await saved.saveJourney('From here', r.journeys[0]!);
    const payload = calls[0]!.payload as { origin: PlaceRef };
    expect(payload.origin.type).not.toBe('current_location');
    expect(payload.origin.label).toBe('Your location at the time');
  });

  it('validates names', async () => {
    const { client } = fakeClient();
    const saved = createSavedService(client, 'user-1');
    await expect(saved.renameJourney('x', '   ')).rejects.toThrow();
    await expect(saved.renamePlace('x', 'x'.repeat(61))).rejects.toThrow();
  });
});

describe('reports', () => {
  it('validates input', () => {
    const base = { type: 'fare_change' as const, routeId: null, stopId: null, suggestedMin: '', suggestedMax: '' };
    expect(reportFormSchema.safeParse({ ...base, description: 'too short' }).success).toBe(false);
    expect(reportFormSchema.safeParse({ ...base, description: 'Fare went up last week', suggestedMin: '10', suggestedMax: '8' }).success).toBe(false);
    const ok = reportFormSchema.safeParse({ ...base, description: 'Fare went up last week', suggestedMin: '10,50', suggestedMax: '' });
    expect(ok.success && ok.data.suggestedMin).toBe(10.5);
  });

  it('requires sign-in and files the report as the current user', async () => {
    const input = { type: 'route_info' as const, description: 'This trotro no longer stops here', routeId: null, stopId: null, suggestedMin: '', suggestedMax: '' };
    await expect(submitReport(null, null, input)).rejects.toBeInstanceOf(AuthRequiredError);
    const { client, calls } = fakeClient();
    await submitReport(client, 'user-9', input, { context: 'Circle → UG' });
    expect(calls[0]).toMatchObject({ table: 'route_reports', op: 'insert', payload: { user_id: 'user-9', report_type: 'route_info' } });
    // The client never sends a status: new reports are always "open" (enforced by RLS too).
    expect((calls[0]!.payload as Record<string, unknown>).status).toBeUndefined();
  });
});

describe('admin service', () => {
  it('refuses all writes for non-staff before contacting the server', async () => {
    const { client, calls } = fakeClient();
    const admin = createAdminService(client, false);
    await expect(admin.listReports('open')).rejects.toBeInstanceOf(NotStaffError);
    await expect(
      admin.saveStop(null, { cityId: 'accra', name: 'New stop', kind: 'roadside', lat: '5.6', lng: '-0.2', landmarkHint: '', aliases: '', verification: 'unverified', isActive: true, isDemo: false, markVerifiedNow: false }),
    ).rejects.toBeInstanceOf(NotStaffError);
    expect(calls).toHaveLength(0);
  });

  it('validates stops are in Ghana and routes have at least two stops', async () => {
    const { client } = fakeClient();
    const admin = createAdminService(client, true);
    await expect(
      admin.saveStop(null, { cityId: 'accra', name: 'Lagos', kind: 'roadside', lat: '6.5', lng: '3.4', landmarkHint: '', aliases: '', verification: 'unverified', isActive: true, isDemo: false, markVerifiedNow: false }),
    ).rejects.toThrow(/in Ghana/);
    await expect(admin.replaceRouteStops('r', [{ stopId: '00000000-0000-4000-8000-000000000000', minutes: '' }])).rejects.toThrow(/at least two stops/);
  });
});

describe('network loading and offline behaviour', () => {
  const deps = (over: Partial<NetworkDeps>): NetworkDeps => ({
    fetchRemote: null,
    readCache: async () => null,
    writeCache: async () => undefined,
    bundledDemo: () => demo,
    ...over,
  });

  it('uses live data and caches it', async () => {
    const writeCache = jest.fn(async () => undefined);
    const r = await loadNetwork(deps({ fetchRemote: async () => network, writeCache }));
    expect(r.origin).toBe('live');
    expect(writeCache).toHaveBeenCalled();
  });

  it('falls back to the cached copy (labelled) when the server is unreachable', async () => {
    const r = await loadNetwork(
      deps({
        fetchRemote: async () => {
          throw new Error('Network request failed');
        },
        readCache: async () => ({ savedAt: '2026-10-01T08:00:00Z', value: network }),
      }),
    );
    expect(r).toMatchObject({ origin: 'cache', fetchedAt: '2026-10-01T08:00:00Z', refreshError: 'Network request failed' });
  });

  it('never silently swaps in DEMO data when a configured backend is down and nothing is cached', async () => {
    await expect(
      loadNetwork(
        deps({
          fetchRemote: async () => {
            throw new Error('offline');
          },
        }),
      ),
    ).rejects.toBeInstanceOf(NetworkUnavailableError);
  });

  it('uses the bundled DEMO network only when no backend is configured', async () => {
    const r = await loadNetwork(deps({}));
    expect(r.origin).toBe('bundled_demo');
  });

  it('rejects malformed server data', async () => {
    await expect(loadNetwork(deps({ fetchRemote: async () => ({ stops: 'nope' }) }))).rejects.toBeInstanceOf(NetworkUnavailableError);
  });
});

describe('map clustering', () => {
  const pts = [
    { id: 'a', lat: 5.6, lng: -0.2 },
    { id: 'b', lat: 5.6001, lng: -0.2001 },
    { id: 'c', lat: 5.7, lng: -0.1 },
  ];
  it('groups nearby points when zoomed out', () => {
    const out = clusterPoints(pts, { latitude: 5.6, longitude: -0.2, latitudeDelta: 0.3, longitudeDelta: 0.3 });
    expect(out.find((i) => i.type === 'cluster')).toMatchObject({ count: 2 });
  });
  it('shows every point when zoomed in', () => {
    const out = clusterPoints(pts, { latitude: 5.6, longitude: -0.2, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    expect(out.every((i) => i.type === 'point')).toBe(true);
  });
});
