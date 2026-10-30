# Test results

Re-run on 2026-10-16 after fixes (Node v22.22.2). See "Fixes on 2026-10-16" at the end.

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings |
| Unit + UI flow tests (Jest) | `npm run test:unit` | ✅ 83 passed, 9 suites |
| Database / RLS tests (PGlite + PostGIS) | `npm run test:db` | ✅ 16 passed |
| Android JS bundle | `npx expo export --platform android` | ✅ bundles (Hermes, 4.4 MB) |
| iOS JS bundle | `npx expo export --platform ios` | ✅ bundles (Hermes, 4.2 MB) |
| Native project generation | `npx expo prebuild --platform android` | ✅ generated (then discarded; CNG) |
| expo-doctor | `npx expo-doctor` | 19/21 — the 2 failures were network checks that could not reach exp.host / React Native Directory from the sandbox. Re-run locally. |

Not run here: a native build on a device/emulator (no Android SDK or Xcode in the sandbox) and anything needing your Supabase project or Google credentials.

## Jest (verbose)

```
PASS tests/flows/app-flows.test.tsx (6.608 s)
    ✓ opens on Home, plans Circle → University of Ghana, shows the map and step-by-step instructions (3304 ms)
    ✓ explains when no verified connection exists instead of inventing one (542 ms)
    ✓ swaps origin and destination (456 ms)
    ✓ sends signed-out users away from the admin area (88 ms)
    ✓ does not show the admin entry on the profile screen for ordinary users (81 ms)
    ✓ reporting explains that it needs the backend when none is configured (46 ms)
PASS tests/unit/geo-services.test.ts
    ✓ is off unless configured (2 ms)
    ✓ parses Nominatim results, restricted to Ghana (48 ms)
    ✓ returns street geometry from an OSRM foot route (1 ms)
    ✓ returns null (straight-line fallback) on failure or when not configured (1 ms)
PASS tests/unit/services.test.ts
    ✓ refuses to save or list anything when signed out (25 ms)
    ✓ refuses when there is no backend at all (1 ms)
    ✓ saves a planned journey for the signed-in user and lists it back (6 ms)
    ✓ never stores device location: current-location trips are skipped and journey ends are anonymised (2 ms)
    ✓ validates names (3 ms)
    ✓ validates input (3 ms)
    ✓ requires sign-in and files the report as the current user (1 ms)
    ✓ refuses all writes for non-staff before contacting the server (16 ms)
    ✓ validates stops are in Ghana and routes have at least two stops (11 ms)
    ✓ uses live data and caches it (14 ms)
    ✓ falls back to the cached copy (labelled) when the server is unreachable (2 ms)
    ✓ never silently swaps in DEMO data when a configured backend is down and nothing is cached (1 ms)
    ✓ uses the bundled DEMO network only when no backend is configured (2 ms)
    ✓ rejects malformed server data (1 ms)
    ✓ groups nearby points when zoomed out (1 ms)
    ✓ shows every point when zoomed in (1 ms)
PASS tests/unit/demo-network.test.ts
    ✓ is entirely labelled as demo data (1 ms)
    ✓ plans Circle → University of Ghana on the Circle–Madina trotro (5 ms)
    ✓ plans University of Ghana → Accra Mall with a transfer to a line taxi (4 ms)
    ✓ respects one-way demo routes: Achimota → Accra Central is not available (3 ms)
    ✓ explains when a destination has no nearby stops (Atomic Junction) (3 ms)
    ✓ marks unknown fares on the reverse route as incomplete, not free (4 ms)
    ✓ supports intercity routes in the same model (14 ms)
PASS tests/unit/planner.test.ts
    ✓ finds a direct ride with access and egress walks as ordered legs (4 ms)
    ✓ does not invent a reverse service: E → A has no route (1 ms)
    ✓ handles a transfer that needs a short walk between stops (2 ms)
    ✓ respects the maximum number of transfers (1 ms)
    ✓ reports when the origin has no stops within walking distance (1 ms)
    ✓ reports when the destination has no stops within walking distance (1 ms)
    ✓ isolated stops are not reachable just because they exist (1 ms)
    ✓ rejects identical origin and destination (1 ms)
    ✓ limits walking: a long walk to a better stop is not used (2 ms)
    ✓ offers a walking-only option when the destination is close (1 ms)
    ✓ generates ranked alternatives and only tags comparisons the data supports (21 ms)
    ✓ does not tag lowest fare when any alternative has an unknown fare (2 ms)
    ✓ marks journeys that rely on demo or unverified data (2 ms)
    ✓ reuses one cached graph across searches (2 ms)
    ✓ returns an explicit empty-network result (1 ms)
PASS tests/unit/fares-durations.test.ts
    ✓ prefers a fare recorded for the exact boarding/alighting pair (1 ms)
    ✓ falls back to the flat route fare and says so (1 ms)
    ✓ ignores fares outside their effective dates
    ✓ ignores inactive fares and prefers verified over unverified
    ✓ returns null (unknown) when no fare is recorded
    ✓ sums known legs into a complete total
    ✓ never treats an unknown leg as free (1 ms)
    ✓ reports a fully unknown fare
    ✓ flags unverified fares (1 ms)
    ✓ end-to-end: transfer journey with an unknown leg is partial (11 ms)
    ✓ sums recorded hop times (1 ms)
    ✓ estimates missing hops from distance and flags the result (1 ms)
    ✓ rejects backwards or out-of-range segments (10 ms)
    ✓ counts waiting only where the route records it, otherwise marks the total as estimated (1 ms)
    ✓ formats recorded times precisely and estimates as rounded ranges (1 ms)
PASS tests/unit/locations-instructions.test.ts
    ✓ requires 2–80 characters after trimming (1 ms)
    ✓ rejects control characters and markup
    ✓ returns no results for invalid queries
    ✓ normalises case, accents and punctuation (1 ms)
    ✓ finds places by common aliases (2 ms)
    ✓ matches multi-word partial queries (1 ms)
    ✓ includes stops and terminals as well as places
    ✓ labels demo records (1 ms)
    ✓ produce a chronological timeline from leg data, including the transfer (12 ms)
    ✓ says a fare is not recorded rather than inventing one (2 ms)
PASS tests/unit/graph.test.ts
    ✓ creates ride edges only in the recorded direction of travel (2 ms)
    ✓ builds n·(n−1)/2 ride edges per route (1 ms)
    ✓ links nearby stops with walking transfers, never with rides (1 ms)
    ✓ does not create walking links beyond the transfer limit (1 ms)
    ✓ skips inactive routes, routes with inactive stops and excluded routes (2 ms)
    ✓ rejects routes that reference unknown stops
    ✓ finds nearby stops sorted by walking distance (1 ms)
Test Suites: 8 passed, 8 total
Tests:       80 passed, 80 total
```

## Database tests (node --test)

```
  ✔ anonymous users can read stops, routes, fares and the network snapshot (24.078279ms)
  ✔ nearby_stops uses PostGIS and returns closest first (223.29629ms)
  ✔ anonymous users cannot modify network data (7.826584ms)
  ✔ ordinary signed-in users cannot modify official routes, stops or fares (14.3687ms)
  ✔ staff (editor role) can update network data and replace route stops (50.504201ms)
  ✔ fare segments must follow the route direction (30.039027ms)
✔ public network data (18876.609588ms)
  ✔ users cannot grant themselves admin or editor (14.64284ms)
  ✔ editors cannot escalate to admin either (15.145785ms)
✔ roles (30.434994ms)
  ✔ a profile is created on sign-up and only its owner can see it (14.890003ms)
  ✔ users can save places and journeys, and only see their own (45.682737ms)
  ✔ anonymous users cannot read anyone’s saved data (12.437052ms)
  ✔ device location is never stored in recent searches, and history is capped (66.885634ms)
✔ private user data (140.428824ms)
  ✔ signed-in users can file a report; it starts open and cannot be self-resolved (27.964931ms)
  ✔ anonymous users cannot file reports (2.829727ms)
  ✔ other users cannot see the report; staff can review it without changing network verification (13.931835ms)
✔ route reports (45.069478ms)
  ✔ get_network() returns exactly the shape and data the app bundles (src/data/demo-network.json) (15696.282569ms)
✔ API contract (15697.188597ms)
ℹ tests 16
ℹ pass 16
ℹ fail 0
```


## Fixes on 2026-10-16

1. **`npm run lint` crashed** (so `npm run check` failed). `eslint.config.js` applied
   `@typescript-eslint/no-explicit-any` to every file, but `eslint-config-expo` only registers the
   `@typescript-eslint` plugin for `.ts/.tsx`. The rule is now scoped to TS files, and `no-console`
   to `src/`. Lint now passes with 0 errors.
2. **Copying `.env.example` unchanged broke the app.** It shipped non-empty placeholder Supabase
   values, so the app tried to reach a fake backend and showed "Couldn't load transport data"
   instead of DEMO mode. `.env.example` now leaves them empty, and `src/lib/env.ts` treats template
   placeholders (`YOUR-PROJECT-REF`, `REPLACE_ME`, `YOUR_KEY`) as unset. Covered by `tests/unit/env.test.ts`.
3. **Google sign-in could show a false "link expired" error on Android.** The OAuth redirect reaches
   both `openAuthSessionAsync()` and the `/auth/callback` route; both exchanged the single-use PKCE
   code. `AuthProvider` now shares one exchange per code.


## Fixes on 2026-10-30 (Android Studio build)

1. **App crashed on Android the first time a map opened when no Google Maps key was set.**
   react-native-maps' config plugin drops the `com.google.android.geo.API_KEY` manifest entry when
   the key is empty, and the Maps SDK throws "API key not found". The new `plugins/withAndroidMapsKey.js`
   always declares the entry from a `${googleMapsApiKey}` placeholder that Gradle fills at build time
   from `.env`, `android/local.properties`, a Gradle property or an environment variable. No key now
   means a blank map, not a crash, and the key can be added in Android Studio without re-running prebuild.
2. **`eas.json` used `developmentClient: true` but `expo-dev-client` wasn't installed**, so development
   builds had no dev launcher. Added `expo-dev-client`.
3. **Typography didn't match the Figma design system (Manrope).** Added `@expo-google-fonts/manrope`
   (five weights), loaded in the root layout behind the splash screen. `AppText` maps each weight to its
   own font family, because Android ignores `fontWeight` for custom fonts or fakes a bold.
4. Added `ANDROID_STUDIO.md` and the `prebuild:android` / `android:release` scripts; the generated
   `android/` project is included so it opens directly in Android Studio.

Re-checked: typecheck ✅, lint ✅ 0 problems, Jest ✅ 83/83, `expo export --platform android` ✅,
`expo prebuild --platform android` ✅. A Gradle build could not run in the sandbox (no Android SDK or
access to Google's Maven), so the first real build is on your machine.
