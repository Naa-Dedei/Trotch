# Running Trotch from Android Studio

Trotch is an Expo (React Native) app. The `android/` folder is a normal Android Studio /
Gradle project generated from `app.config.ts`; the screens and logic live in `src/` (TypeScript).
Android Studio builds and installs the native app; the JavaScript is served by Metro in debug
builds and bundled into the APK in release builds.

## One-time setup (Windows)

1. Install **Node.js 22 LTS** and **Android Studio** (it includes the JDK and SDK manager).
2. In Android Studio → **Settings → Languages & Frameworks → Android SDK**, install
   **Android SDK Platform 36** (or whatever `compileSdk` Gradle asks for) and, under **SDK Tools**,
   **NDK (Side by side)** and **CMake**. Gradle will tell you the exact versions if one is missing.
3. Create an emulator in **Device Manager** (a Pixel with a recent Google APIs image), or plug in a
   phone with USB debugging on.
4. Put the project in a **short path**, e.g. `C:\dev\trotch`. React Native's C++ build fails on
   Windows when paths get longer than 260 characters (deep folders like Downloads\…\trotch-fixed\trotch).

## Every time you get fresh code

```powershell
cd C:\dev\trotch
npm install                         # Gradle calls Node to find React Native, so this must run first
Copy-Item .env.example .env         # first time only; edit it (empty Supabase = DEMO mode)
```

If you changed `app.config.ts`, added a native package, or the `android/` folder is missing:

```powershell
npm run prebuild:android            # regenerates android/ from app.config.ts
```

## Open and run

1. Android Studio → **File → Open** → select the **`android`** folder (not the project root).
   Wait for the Gradle sync to finish. The first sync and build take a while.
2. **Debug build (for development):** in a terminal in the project root run `npx expo start`,
   then press **Run ▶** in Android Studio. The app opens the Expo dev launcher and connects to
   Metro; code changes in `src/` reload instantly.
3. **Release build (works on its own, no laptop needed):** Android Studio → **Build Variants** →
   set `app` to **release**, then Run ▶ — or `npm run android:release`. The APK is at
   `android/app/build/outputs/apk/release/app-release.apk`. It is signed with the debug key,
   which is fine for demos and coursework but not for the Play Store.

## Google Maps key

Maps on Android need a **Maps SDK for Android** key. Put it in `.env`:

```
GOOGLE_MAPS_ANDROID_API_KEY=AIza...
```

or in `android/local.properties` (same line). Gradle reads it on every build, so just rebuild.
Without a key the app still works; map areas are blank (it no longer crashes).

## Don't edit `android/` by hand

`npm run prebuild:android` deletes and regenerates it. Make native changes in `app.config.ts`
or a config plugin in `plugins/` instead.

## Common errors

| Error | Fix |
|---|---|
| `Cannot run program "node"` during Gradle sync | Install Node, restart Android Studio, run `npm install` in the project root. |
| `Filename longer than 260 characters` / CMake errors on Windows | Move the project to a short path such as `C:\dev\trotch`. |
| `SDK location not found` | Open the `android` folder in Android Studio once; it writes `local.properties` with `sdk.dir`. |
| `NDK ... did not have a source.properties file` | Install the NDK version from the error message in the SDK Manager. |
| White screen / "Unable to load script" on a debug build | Start Metro with `npx expo start`. On a real phone use the same Wi-Fi or run `adb reverse tcp:8081 tcp:8081`. |
| Blank map | Set `GOOGLE_MAPS_ANDROID_API_KEY` and rebuild; in Google Cloud, allow the key for package `com.realfin.trotch` and your debug SHA-1 (`cd android; ./gradlew signingReport`). |
