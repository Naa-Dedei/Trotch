# Trotch

**Know where to go. Know what to take. Get there.**

Trotch is a native mobile app (Android and iOS) for getting around Greater Accra by trotro, shared (line) taxi, bus and on foot. You enter where you are and where you're going; Trotch compares journeys built **only from recorded routes**, shows where to board, which vehicle to take, where to get off or change, and what each leg costs.

Built with Expo SDK 57 (React Native 0.86), Expo Router, TypeScript (strict) and Supabase (Postgres + PostGIS, Auth, Row Level Security).

> ⚠️ **The bundled data is DEMO data.** The place names are real and coordinates approximate, but every route, stop order, travel time and fare in `scripts/demo-network.source.mjs` is illustrative. All of it is flagged `is_demo = true` / unverified and labelled “DEMO” throughout the app. Replace it with surveyed data before anyone relies on it.

---

## Contents

1. [What works](#what-works)
2. [What still needs real data, credentials or integrations](#what-still-needs-real-data-credentials-or-integrations)
3. [Quick start (Windows PowerShell)](#quick-start-windows-powershell)
4. [Running on Android and iOS](#running-on-android-and-ios)
5. [Supabase setup](#supabase-setup)
6. [Google sign-in](#google-sign-in)
7. [Maps, geocoding and walking directions](#maps-geocoding-and-walking-directions)
8. [Environment variables](#environment-variables)
9. [Architecture](#architecture)
10. [The route-planning engine](#the-route-planning-engine)
11. [Data model and data quality](#data-model-and-data-quality)
12. [Security model](#security-model)
13. [Offline and poor-network behaviour](#offline-and-poor-network-behaviour)
14. [Testing](#testing)
15. [Building and distributing with EAS](#building-and-distributing-with-eas)

---

## What works

Verified by the automated checks in [`TEST_RESULTS.md`](TEST_RESULTS.md):

- **Journey planning (anonymous, no account needed)** — origin/destination search by name, landmark, terminal or alias (“Legon”, “Odawna”, “KIA”), current location, swap, saved places and recents → ranked alternatives → journey details.
- **Real graph routing** — multi-label Dijkstra over stops; directional routes; walking access, egress and transfers with distance limits; transfer limits; configurable weights; alternatives; a walking-only option for short trips. Proximity never creates a ride.
- **Honest outputs** — fares summed per leg in GH₵, unknown legs shown as “+ ?” and never treated as free; recorded vs estimated durations (estimates shown as rounded ranges); “Fastest / Lowest fare / Fewest transfers” tags only when the data supports the comparison; a clear “not yet available in Trotch's verified network” message when there is no recorded connection.
- **Journey details** — interactive map with the journey highlighted (mode-coloured rides, dashed walks, origin/destination, stops), auto-fit, a chronological step-by-step timeline (walk → board → ride → get off → change → arrive) with boarding hints, the mate's call-out, fare and data-quality warnings, tap-through to stop details, sharing as text.
- **Explore** — map of stops and route overlays, search, mode and terminal filters, grid marker clustering, “near me”, stop panel with routes in their recorded direction plus verification/freshness labels.
- **Stop and route pages** — routes serving a stop, nearby stops, ordered stop list with times, current fares with verification labels, favourite toggle, report buttons.
- **Accounts (when Supabase is configured)** — email/password sign-up and sign-in, Google sign-in (Supabase OAuth + PKCE), password recovery by deep link, persisted sessions in the device keychain/keystore, sign-out, display-name editing.
- **Saved items** — Home / School / Work / custom places, favourite routes, saved journeys (stored as snapshots and also kept on the device for offline viewing), recent searches; rename and delete everything.
- **Reports** — wrong stop location, wrong route info, changed fare, missing route, other; stored for staff review; never applied automatically.
- **Admin workflow (staff only, in-app)** — create/edit stops (map preview, aliases, boarding hints), routes (mode, headsign, call-out, wait, notes), ordered stops with per-hop minutes (atomic server-side replace), route geometry (generate from stops / clear), fares (segment or whole-route, effective dates, retire or delete), verification status and “record a check now”, and report review. Enforced by RLS, not just hidden in the UI.
- **Supabase backend** — migrations with constraints, foreign keys, PostGIS spatial indexes, triggers, RPCs (`get_network`, `network_version`, `nearby_stops`, `replace_route_stops`, `review_report`) and RLS on every table. All tested against a real Postgres + PostGIS engine.
- **Runs without a backend** — leave Supabase unset and the app plans journeys on the bundled DEMO network (clearly bannered); account features say they're unavailable instead of failing.

## What still needs real data, credentials or integrations

| Item | Why / what to do |
|---|---|
| **Real transport data** | The network is DEMO. Survey routes (stops in order, both directions as separate routes), hop times and fares; enter them via the admin screens or SQL, and mark them `verified` only after a human check. |
| **Supabase project** | Create one and set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without it: no accounts, saving, reports or admin. |
| **Google OAuth credentials** | Google Cloud OAuth client + Supabase provider config (below). |
| **Google Maps Android key** | Required for the map on Android dev/production builds. iOS uses Apple Maps with no key. |
| **Geocoding outside the network** (optional) | Nominatim-compatible server or Mapbox token. Off by default; in-network search works without it. |
| **Street-level walking paths** (optional) | OSRM foot server or Mapbox. When configured, the journey map draws walk legs along streets; otherwise they're straight dashed lines. Walking distances/times in the steps stay distance-based estimates either way. |
| **Email sending** | Supabase's built-in mailer is rate-limited; configure SMTP in Supabase for production confirmation/reset emails. |
| **Not built** | Live traffic, real-time vehicle positions or departures (no reliable source), push notifications, full offline *place search* outside the network, App Store / Play Store publication (not done). |

---

## Quick start (Windows PowerShell)

Prerequisites: Node.js 20 LTS or 22 LTS, Git. For running on a device see [Running on Android and iOS](#running-on-android-and-ios).

```powershell
git clone <your-repo-url> trotch
cd trotch
npm install                       # .npmrc sets legacy-peer-deps for Expo SDK 57's peer ranges
Copy-Item .env.example .env       # then edit .env (or leave Supabase empty for DEMO mode)

npm run typecheck
npm run lint
npm test                          # Jest unit/UI tests + database RLS tests

npx expo start                    # dev server; press "a" for Android once a dev build is installed
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm run android` / `npm run ios` | Build and run a local development build (`expo run:*`) |
| `npm start` | Start Metro for an installed development build |
| `npm run start:go` | Start for Expo Go (quick UI checks only — see below) |
| `npm run check` | Typecheck + lint + all tests |
| `npm run seed:generate` | Regenerate `src/data/demo-network.json` and `supabase/seed.sql` from `scripts/demo-network.source.mjs` |

## Running on Android and iOS

Trotch uses native modules (maps, secure storage, location), so the supported way to run it is a **development build** — your own debug app containing those modules.

**Option A — cloud build with EAS (no Android Studio/Xcode needed):**

```powershell
npx eas-cli@latest login
npx eas-cli@latest init                                   # creates the EAS project; copy the id into EAS_PROJECT_ID
npx eas-cli@latest env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value "<key>" --environment development --visibility secret
npx eas-cli@latest build --profile development --platform android   # installable APK
npx eas-cli@latest build --profile development --platform ios       # needs an Apple Developer account; register devices with `eas device:create`
npx expo start                                            # then open the dev build on the phone and connect
```

Also add your `EXPO_PUBLIC_*` variables to the EAS environments (or keep them in `.env` for local `expo start`; Metro inlines them at bundle time).

**Option B — local build / Android Studio:** install Android Studio (SDK + an emulator) and run `npm run android`, or open the `android/` folder in Android Studio and press Run. Step-by-step guide and common errors: [`ANDROID_STUDIO.md`](ANDROID_STUDIO.md). iOS local builds require macOS with Xcode: `npm run ios`.

**Expo Go:** `npm run start:go` can be useful for quick UI checks, but Expo Go only contains the native modules it ships with and uses its own URL scheme, so maps keys, Google sign-in redirects and other native configuration may not behave like the real app. Use a development build for anything you'd sign off.

## Supabase setup

1. Create a project at supabase.com. In **Project Settings → API** copy the project URL and the **publishable** (or legacy anon) key into `.env`. Never copy the service-role key into the app.
2. Apply the schema. Either:
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`; or
   - **SQL editor:** run the three files in `supabase/migrations/` in order.
3. Load the DEMO data (optional, for testing): run `supabase/seed.sql` in the SQL editor. Local `supabase start` / `supabase db reset` loads it automatically.
4. **Auth → URL configuration:** add redirect URLs `trotch://auth/callback` and `trotch://auth/reset-password` (and `exp://**` only while testing in Expo Go).
5. **Make yourself staff:** sign up in the app, then run `supabase/admin/grant-staff-role.sql` (with your email) in the SQL editor. Reopen the Profile tab to see “Network admin”.

Local development alternative: install Docker, then `npx supabase start` (uses `supabase/config.toml`, applies migrations and seed) and point `.env` at the local URL/key it prints.

## Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID → Web application**.
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Providers → Google**: enable, paste the client ID and secret.
3. Make sure `trotch://auth/callback` is in Supabase's redirect URL allow-list (step 4 above).

How it works in the app: `signInWithOAuth({ skipBrowserRedirect: true })` → system auth browser (`expo-web-browser`) → Supabase redirects to `trotch://auth/callback?code=…` → the app exchanges the code (PKCE) for a session. No Google secrets are in the app.

## Maps, geocoding and walking directions

**Map tiles.** `react-native-maps` uses Google Maps on Android and Apple Maps on iOS.
- Android: enable **Maps SDK for Android** in Google Cloud, create an API key restricted to your package name + SHA-1 signing fingerprints (`eas credentials` shows them), and set `GOOGLE_MAPS_ANDROID_API_KEY` (build-time; it's injected into the native manifest by the config plugin).
- iOS: nothing required. (To use Google Maps on iOS instead, set `GOOGLE_MAPS_IOS_API_KEY` and pass `provider="google"` in `TransitMap`.)
- Custom tiles (e.g. MapTiler): set `EXPO_PUBLIC_MAP_TILE_URL` and `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`. Don't point production apps at `tile.openstreetmap.org` — its usage policy forbids heavy app use.
- If the map fails to render, an error boundary shows a fallback and the journey steps still work; if the native map doesn't report ready within 10 s (e.g. a missing Android key), the map shows a warning.

**Geocoding (places outside the Trotch network).** Off by default. Set `EXPO_PUBLIC_GEOCODER=nominatim` (with `EXPO_PUBLIC_GEOCODER_URL` pointing at a provider you're allowed to use and a contact email) or `mapbox` (with `EXPO_PUBLIC_MAPBOX_TOKEN`). Results are restricted to Ghana and are only coordinates — the planner still decides whether any recorded route serves them.

**Walking directions.** `EXPO_PUBLIC_WALKING_PROVIDER=osrm` with `EXPO_PUBLIC_OSRM_URL` (an OSRM server with a `foot` profile), or `mapbox`. Used to draw walk legs along real streets on the journey map; failures fall back to straight lines silently.

## Environment variables

See [`.env.example`](.env.example) — every variable is documented there. Rules:

- `EXPO_PUBLIC_*` values are compiled into the app and readable by anyone; only public keys go there.
- `GOOGLE_MAPS_*`, `TROTCH_*`, `EAS_PROJECT_ID` are read by `app.config.ts` at build time.
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` are used only by the Supabase CLI for local dev.
- The Supabase **service-role key is never used** anywhere in this project.

---

## Architecture

```
src/
  app/                    Expo Router screens (file = route)
    (tabs)/               Home, Plan, Explore, Saved, Profile
    journey/[id].tsx      Journey details (planned result or saved snapshot)
    stop/[id].tsx         Stop details
    route/[id].tsx        Route details, fares, favourite
    search.tsx            Place picker (modal)
    report.tsx            Report a problem (modal)
    saved-place.tsx       Add a saved place (modal)
    settings.tsx
    auth/                 sign-in, sign-up, forgot/reset password, OAuth callback
    admin/                Staff-only stops/routes/fares/reports management
  components/             Design system (ui.tsx), Screen, map, journey cards, timeline, forms
  constants/theme.ts      Colours, mode styles, verification styles, spacing, type scale
  features/
    routing/              ← framework-free engine: graph, search, planner, fares, durations, instructions, format
    locations/            Search index, alias matching, query validation (zod)
    network/              Network loading (live → cache → DEMO), schema validation, stop/route queries, provider
    planner/              Planner state (origin, destination, results, recents)
    saved/                Saved places/routes/journeys service + provider
    reports/              Report schema + submission
    admin/                Staff data-management service + validation
    auth/                 Supabase auth provider (email, Google, reset) + form schemas
    map/                  Clustering and journey/route overlays
  services/
    supabase/             Client (SecureStore session storage, PKCE), error mapping
    geo/                  Location permission/position, geocoding, walking directions
  lib/                    env, geo maths, cache storage
  data/demo-network.json  Generated DEMO network (bundled fallback)
  types/transport.ts      Domain types
supabase/
  migrations/             Schema, security (RLS), API functions
  seed.sql                Generated DEMO seed
  admin/                  Role-grant script
  config.toml             Local CLI config
scripts/                  DEMO data source + generator
tests/
  unit/                   Engine, fares, durations, search, instructions, services, offline loading
  flows/                  Expo Router UI flow tests
  db/                     Migrations + RLS + API contract on PGlite/PostGIS
```

The routing engine has no React, Supabase or Expo imports, so it runs identically in tests, on the device, and offline.

## The route-planning engine

`src/features/routing/`

- **Graph** (`graph.ts`): nodes are stops, plus virtual origin/destination nodes per search. **Ride edges** are created only from recorded routes and only forward along each route (for A→B→C: A→B, A→C, B→C — never the reverse). **Walk edges** join stops within the transfer limit, and connect the origin/destination to stops within the access limit. Inactive routes/stops and routes referencing unknown stops are skipped.
- **Search** (`search.ts`): multi-label Dijkstra with a binary heap. The state is *(node, rides so far, last edge kind, last route)*, which enforces the transfer limit exactly, forbids walk→walk chains, and avoids re-boarding the same route.
- **Cost** (minutes-equivalent): `walk × 1.6 + wait × 1.3 + in-vehicle × 1.0 + 8 per transfer` by default, configurable via `PlannerOptions.weights`. Waits use the route's recorded typical wait or, for ranking only, an assumed wait per mode (never displayed as fact).
- **Alternatives** (`planner.ts`): best path, then re-searches that ban each route used by the best path, plus “fewest transfers” and “less walking” profiles; de-duplicated, re-scored with the default weights, and filtered to reasonable options (≤ 1.8× best + 15).
- **Limits** (defaults): 1.2 km access/egress walk, 500 m transfer walk, 1.5 km walking-only journey, 2 transfers, 3 alternatives — all in `options.ts`.
- **Fares** (`fares.ts`): exact boarding→alighting fare first, otherwise the route's flat fare (labelled “whole-route fare; shorter trips may cost less”); only fares effective today and not inactive; verified preferred. Totals are complete / partial (“GH₵7–8 + ?”) / unknown.
- **Durations** (`durations.ts`): recorded hop times where present; missing hops estimated from distance at conservative Accra speeds and flagged; walking always estimated; formatted as ranges when estimated.
- **Instructions** (`instructions.ts`): plain-language steps generated only from leg data.

## Data model and data quality

Tables (all in `public`): `cities`, `data_sources`, `locations` + `location_aliases`, `stops` + `stop_aliases`, `routes`, `route_stops` (ordered, minutes from previous), `fares` (GH₵ min/max, segment or flat, effective dates, source, verification), `profiles`, `user_roles`, `saved_places`, `saved_routes`, `saved_journeys`, `recent_searches`, `route_reports`.

- Stops and locations have PostGIS `geography(Point)` columns (generated from lat/lng) with GiST indexes.
- Routes are directional; trotro routes need no number; routes can carry a GeoJSON path.
- A trigger rejects fare segments that don't follow the route's direction.
- Every network record carries `verification_status` (**verified, community_reported, unverified, outdated, inactive**), `source_id`, `last_verified_at` and `is_demo`; the app shows these labels and “last checked” freshness.
- Reports never change network data; staff apply corrections by editing records.

## Security model

- **RLS on every table.** Public network data: readable by everyone (incl. anonymous), writable only when `is_network_editor()` (role `admin` or `editor`). Private data: owner only. Reports: insert as yourself with status `open` only; readable by author and staff; status changes by staff only.
- **Roles can't be self-assigned.** `user_roles` has no write policies and write privileges are revoked from client roles; grants happen only via SQL as the service role.
- Role checks are `SECURITY DEFINER` functions with a fixed `search_path`; API functions run as `SECURITY INVOKER` so RLS still applies; trigger-only functions aren't executable via the API.
- The admin UI is hidden for non-staff, but the database is the real gate — tested directly.
- Sessions are stored in the device keychain/keystore (`expo-secure-store`, chunked). Only non-sensitive data (public network, saved-journey copies, anonymous recents) goes to AsyncStorage.
- **Location privacy:** permission is requested only when you tap a location button, with an explanation first; foreground only (background location is blocked in the manifest); “My location” is never written to search history — enforced both in the app and by a database `CHECK` constraint.
- Errors shown to users are mapped to friendly messages; raw backend messages are only logged in development.

## Offline and poor-network behaviour

- The whole network snapshot comes from one RPC (`get_network`) and is cached on the device. On start the cached copy is shown immediately, then refreshed.
- If a refresh fails, the app keeps working on the cached copy and says so (“Showing saved copy … from 3 days ago”).
- **Journey planning works offline with a cached network**, because the engine and in-network place search run on the device. Searching for places *outside* the network (geocoding) needs a connection.
- If a backend is configured but unreachable and nothing is cached, the app shows an error — it never silently substitutes DEMO data.
- Saved journeys are snapshots, also copied to the device, so they open offline.

## Testing

```powershell
npm run typecheck   # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint        # expo lint (eslint-config-expo, React Compiler rules)
npm run test:unit   # Jest: engine, services, UI flows
npm run test:db     # node --test: migrations + RLS + API contract on in-process Postgres/PostGIS (PGlite)
npm test            # both
```

What's covered: graph construction, directional connections, invalid connections (reverse, proximity-only, isolated stops), route search, transfers and transfer limits, walking limits, alternatives and tag rules, fare lookup/effective dates/verification preference, unknown-fare handling, durations and formatting, location search validation and alias matching, instructions, saved-item auth requirements and location privacy, report validation, admin guards, offline/cache loading, clustering, and UI flows (open app → search origin → search destination → find routes → select → map → instructions; no-route message; swap; admin redirect; no admin entry for ordinary users). The DB suite checks anonymous/user/editor permissions, self-escalation, ownership isolation, report rules, the location-history constraint, PostGIS nearby search, and that `get_network()` matches the app's bundled data shape exactly.

Latest results: [`TEST_RESULTS.md`](TEST_RESULTS.md). On-device checks of flows that need a real backend (sign-in, saving, reporting, admin edits) should be done with a development build against your Supabase project; a Maestro E2E suite would be the natural next step.

## Building and distributing with EAS

Profiles are in `eas.json`:

| Profile | Use |
|---|---|
| `development` | Dev client APK / device build for day-to-day work |
| `development-simulator` | iOS simulator dev build |
| `preview` | Internal-distribution APK / ad-hoc iOS build for testers |
| `production` | Store builds (auto-incrementing build numbers) |

```powershell
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform android   # Google Play (needs a Play Console service account)
npx eas-cli@latest submit --platform ios       # App Store Connect / TestFlight
npx eas-cli@latest update --branch production  # over-the-air JS updates (after configuring expo-updates)
```

The app has **not** been published to Google Play or the App Store. Before submitting: replace DEMO data, set real bundle identifiers, restrict API keys, add a privacy policy (location use is described in the permission strings), and complete store listings.
