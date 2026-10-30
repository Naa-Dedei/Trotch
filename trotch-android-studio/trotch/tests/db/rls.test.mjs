/**
 * Database access-control tests. Applies the real migrations + DEMO seed to an in-process
 * Postgres (PGlite + PostGIS) and checks Row Level Security as anon, ordinary users and staff.
 * Run with: npm run test:db
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, createTestDatabase, createUser } from './harness.mjs';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const EDITOR = '33333333-3333-4333-8333-333333333333';

/** @type {import('@electric-sql/pglite').PGlite} */
let db;
let anyStopId;
let anyRouteId;

const rejects = async (fn, pattern) => {
  await assert.rejects(fn, (err) => {
    assert.match(String(err?.message ?? err), pattern);
    return true;
  });
};
const RLS_DENIED = /row-level security|permission denied/i;

before(async () => {
  db = await createTestDatabase();
  await createUser(db, ALICE, 'Alice');
  await createUser(db, BOB, 'Bob');
  await createUser(db, EDITOR, 'Editor');
  // Granting a role is a trusted server-side operation (service role / SQL editor).
  await db.query(`insert into public.user_roles (user_id, role, granted_by) values ($1, 'editor', 'test')`, [EDITOR]);
  anyStopId = (await db.query(`select id from public.stops order by name limit 1`)).rows[0].id;
  anyRouteId = (await db.query(`select id from public.routes order by name limit 1`)).rows[0].id;
});

after(async () => {
  await db?.close();
});

describe('public network data', () => {
  test('anonymous users can read stops, routes, fares and the network snapshot', async () => {
    await as(db, null, async () => {
      const stops = await db.query(`select count(*)::int n from public.stops`);
      assert.equal(stops.rows[0].n, 18);
      const snap = await db.query(`select public.get_network('accra') g`);
      assert.ok(snap.rows[0].g.routes.length > 0);
      assert.ok(snap.rows[0].g.routes.every((r) => r.quality.isDemo === true), 'seed must be labelled DEMO');
    });
  });

  test('nearby_stops uses PostGIS and returns closest first', async () => {
    await as(db, null, async () => {
      // Near Kwame Nkrumah Circle
      const r = await db.query(`select name, distance_m from public.nearby_stops(5.5703, -0.2135, 600, 10)`);
      assert.ok(r.rows.length >= 2);
      assert.match(r.rows[0].name, /Circle/);
      for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i].distance_m >= r.rows[i - 1].distance_m);
    });
  });

  test('anonymous users cannot modify network data', async () => {
    await as(db, null, async () => {
      await rejects(() => db.query(`update public.stops set name = 'Hacked' where id = $1`, [anyStopId]).then(async (r) => {
        // UPDATE under RLS silently affects 0 rows; treat that as a denial.
        if (r.affectedRows === 0) throw new Error('row-level security: no rows updated');
      }), RLS_DENIED);
      await rejects(
        () => db.query(`insert into public.stops (city_id, name, kind, lat, lng) values ('accra', 'Fake', 'roadside', 5.6, -0.2)`),
        RLS_DENIED,
      );
    });
  });

  test('ordinary signed-in users cannot modify official routes, stops or fares', async () => {
    await as(db, ALICE, async () => {
      const upd = await db.query(`update public.routes set verification_status = 'verified' where id = $1`, [anyRouteId]);
      assert.equal(upd.affectedRows, 0);
      const del = await db.query(`delete from public.fares`);
      assert.equal(del.affectedRows, 0);
      await rejects(
        () => db.query(`insert into public.stops (city_id, name, kind, lat, lng) values ('accra', 'Fake', 'roadside', 5.6, -0.2)`),
        RLS_DENIED,
      );
      await rejects(() => db.query(`select public.replace_route_stops($1, '[]'::jsonb)`, [anyRouteId]), /network editors/);
    });
    const still = await db.query(`select verification_status from public.routes where id = $1`, [anyRouteId]);
    assert.equal(still.rows[0].verification_status, 'unverified');
  });

  test('staff (editor role) can update network data and replace route stops', async () => {
    await as(db, EDITOR, async () => {
      const upd = await db.query(`update public.stops set landmark_hint = 'Edited by staff' where id = $1`, [anyStopId]);
      assert.equal(upd.affectedRows, 1);
      const route = (await db.query(`select id from public.routes where name = 'Kaneshie – Circle'`)).rows[0];
      const stops = (await db.query(`select stop_id from public.route_stops where route_id = $1 order by seq`, [route.id])).rows;
      await db.query(`select public.replace_route_stops($1, $2::jsonb)`, [
        route.id,
        JSON.stringify(stops.map((s, i) => ({ stopId: s.stop_id, minutesFromPrevious: i === 0 ? null : 5 }))),
      ]);
      const after = await db.query(`select minutes_from_previous m from public.route_stops where route_id = $1 order by seq`, [route.id]);
      assert.deepEqual(after.rows.map((r) => (r.m === null ? null : Number(r.m))), [null, 5, 5]);
    });
    const who = await db.query(`select updated_by from public.stops where id = $1`, [anyStopId]);
    assert.equal(who.rows[0].updated_by, EDITOR);
  });

  test('fare segments must follow the route direction', async () => {
    const route = (await db.query(`select id from public.routes where name = 'Circle – Madina'`)).rows[0];
    const seq = (await db.query(`select stop_id from public.route_stops where route_id = $1 order by seq`, [route.id])).rows;
    await as(db, EDITOR, async () => {
      await rejects(
        () =>
          db.query(
            `insert into public.fares (route_id, from_stop_id, to_stop_id, min_ghs, max_ghs) values ($1, $2, $3, 5, 6)`,
            [route.id, seq[3].stop_id, seq[1].stop_id],
          ),
        /must come before/,
      );
    });
  });
});

describe('roles', () => {
  test('users cannot grant themselves admin or editor', async () => {
    await as(db, ALICE, async () => {
      await rejects(
        () => db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [ALICE]),
        RLS_DENIED,
      );
      const isAdmin = await db.query(`select public.is_admin() a, public.is_network_editor() e`);
      assert.equal(isAdmin.rows[0].a, false);
      assert.equal(isAdmin.rows[0].e, false);
    });
  });

  test('editors cannot escalate to admin either', async () => {
    await as(db, EDITOR, async () => {
      await rejects(
        () => db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [EDITOR]),
        RLS_DENIED,
      );
      const roles = await db.query(`select role from public.user_roles`);
      assert.deepEqual(roles.rows.map((r) => r.role), ['editor']);
    });
  });
});

describe('private user data', () => {
  test('a profile is created on sign-up and only its owner can see it', async () => {
    await as(db, ALICE, async () => {
      const mine = await db.query(`select display_name from public.profiles`);
      assert.deepEqual(mine.rows.map((r) => r.display_name), ['Alice']);
    });
  });

  test('users can save places and journeys, and only see their own', async () => {
    await as(db, ALICE, async () => {
      await db.query(
        `insert into public.saved_places (kind, label, place_name, lat, lng) values ('home', 'Home', 'Madina', 5.676, -0.166)`,
      );
      await db.query(
        `insert into public.saved_journeys (name, origin, destination, journey) values ('To campus', '{"label":"Circle"}', '{"label":"UG"}', '{"legs":[]}')`,
      );
    });
    await as(db, BOB, async () => {
      assert.equal((await db.query(`select count(*)::int n from public.saved_places`)).rows[0].n, 0);
      assert.equal((await db.query(`select count(*)::int n from public.saved_journeys`)).rows[0].n, 0);
      const del = await db.query(`delete from public.saved_places`);
      assert.equal(del.affectedRows, 0);
      // Cannot write into someone else's account.
      await rejects(
        () =>
          db.query(
            `insert into public.saved_places (user_id, kind, label, place_name, lat, lng) values ($1, 'custom', 'x', 'x', 5.6, -0.2)`,
            [ALICE],
          ),
        RLS_DENIED,
      );
    });
    await as(db, ALICE, async () => {
      assert.equal((await db.query(`select count(*)::int n from public.saved_places`)).rows[0].n, 1);
      // Only one "home" per user.
      await rejects(
        () => db.query(`insert into public.saved_places (kind, label, place_name, lat, lng) values ('home', 'Home 2', 'Osu', 5.56, -0.18)`),
        /duplicate key|unique/i,
      );
    });
  });

  test('anonymous users cannot read anyone’s saved data', async () => {
    await as(db, null, async () => {
      await rejects(() => db.query(`select * from public.saved_places`), /permission denied/);
    });
  });

  test('device location is never stored in recent searches, and history is capped', async () => {
    await as(db, ALICE, async () => {
      await rejects(
        () =>
          db.query(
            `insert into public.recent_searches (origin, destination) values ('{"type":"current_location","lat":5.6,"lng":-0.2}', '{"type":"location","label":"UG"}')`,
          ),
        /recent_no_device_location/,
      );
      for (let i = 0; i < 25; i++) {
        await db.query(`insert into public.recent_searches (origin, destination) values ($1, $2)`, [
          JSON.stringify({ type: 'location', label: `Place ${i}` }),
          JSON.stringify({ type: 'location', label: 'UG' }),
        ]);
      }
      assert.equal((await db.query(`select count(*)::int n from public.recent_searches`)).rows[0].n, 20);
    });
  });
});

describe('route reports', () => {
  let reportId;

  test('signed-in users can file a report; it starts open and cannot be self-resolved', async () => {
    await as(db, ALICE, async () => {
      const r = await db.query(
        `insert into public.route_reports (report_type, route_id, description) values ('route_info', $1, 'This trotro no longer stops here.') returning id, status`,
        [anyRouteId],
      );
      reportId = r.rows[0].id;
      assert.equal(r.rows[0].status, 'open');
      await rejects(
        () =>
          db.query(
            `insert into public.route_reports (report_type, description, status) values ('other', 'Trying to pre-resolve this', 'resolved')`,
          ),
        RLS_DENIED,
      );
      const upd = await db.query(`update public.route_reports set status = 'resolved' where id = $1`, [reportId]);
      assert.equal(upd.affectedRows, 0);
      await rejects(() => db.query(`select public.review_report($1, 'resolved', 'self')`, [reportId]), /network editors/);
    });
  });

  test('anonymous users cannot file reports', async () => {
    await as(db, null, async () => {
      await rejects(
        () => db.query(`insert into public.route_reports (report_type, description) values ('other', 'anonymous report text')`),
        /permission denied/,
      );
    });
  });

  test('other users cannot see the report; staff can review it without changing network verification', async () => {
    await as(db, BOB, async () => {
      assert.equal((await db.query(`select count(*)::int n from public.route_reports`)).rows[0].n, 0);
    });
    await as(db, EDITOR, async () => {
      await db.query(`select public.review_report($1, 'resolved', 'Checked on site')`, [reportId]);
      const r = await db.query(`select status, reviewer_id from public.route_reports where id = $1`, [reportId]);
      assert.equal(r.rows[0].status, 'resolved');
      assert.equal(r.rows[0].reviewer_id, EDITOR);
    });
    const route = await db.query(`select verification_status from public.routes where id = $1`, [anyRouteId]);
    assert.equal(route.rows[0].verification_status, 'unverified', 'reports must never auto-promote data');
  });
});

describe('API contract', () => {
  test('get_network() returns exactly the shape and data the app bundles (src/data/demo-network.json)', async () => {
    const { readFile } = await import('node:fs/promises');
    const bundled = JSON.parse(await readFile(new URL('../../src/data/demo-network.json', import.meta.url), 'utf8'));
    delete bundled._notice;
    // Fresh database so earlier tests' edits don't interfere.
    const fresh = await createTestDatabase();
    try {
      const snap = await as(fresh, null, async () => (await fresh.query(`select public.get_network() g`)).rows[0].g);
      const norm = (net) => ({
        sources: [...net.sources].sort((a, b) => a.id.localeCompare(b.id)),
        stops: [...net.stops].map((s) => ({ ...s, aliases: [...s.aliases].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
        routes: [...net.routes].sort((a, b) => a.id.localeCompare(b.id)),
        fares: [...net.fares].sort((a, b) => a.id.localeCompare(b.id)),
        locations: [...net.locations].map((l) => ({ ...l, aliases: [...l.aliases].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
      });
      assert.deepEqual(norm(snap), norm(bundled));
      assert.ok(snap.version, 'snapshot carries a version for cache validation');
    } finally {
      await fresh.close();
    }
  });
});
