# Building and releasing

## Pieces

| Piece | Where | Notes |
|---|---|---|
| Web app + API server | `server.js`, built by `Dockerfile`, deployed by `cloudbuild.yaml` | The phone apps call this server for everything AI |
| Android app | `android/` | Capacitor 8, package `com.mychurchbiblestudy.app` |
| iOS app | `ios/` | Same package id. Needs a Mac to build |
| Recorder plugin | `plugins/sermon-recorder/` | Our own native code, Android and iOS |
| Database | `supabase/migrations/` | 003 and 004 were applied to the live project on 2026-11-22 |
| Marketing site | `website/` | Static files |

## Server settings

The server reads these when it runs. `cloudbuild.yaml` sets the first three on the Cloud Run service from Secret Manager.

| Name | Needed | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | AI calls. Server only. It is no longer compiled into the web app |
| `SUPABASE_URL`, `SUPABASE_KEY` | yes | Checking who is calling. The key is the public (anon) key |
| `STUDY_MODEL`, `BULLETIN_MODEL`, `SEARCH_MODEL` | no | Override a Gemini model name without a release |
| `ALLOWED_ORIGINS` | no | Extra web origins allowed to call the API |
| `ANDROID_CERT_FINGERPRINTS` | later | Add the Google Play signing key fingerprint so shared links open the app |
| `IOS_APP_ID` | later | `<Apple team id>.com.mychurchbiblestudy.app`, for the same on iPhone |

Check a deployment: `GET /api/health` returns `{"ok":true,"commit":"<sha>","ai":true,"auth":true}`.

## Tests

```
node --env-file=.env.local tests/access.test.mjs     # database access rules, two throwaway accounts
PORT=8080 node --env-file=.env.local server.js &     # then:
node --env-file=.env.local tests/server.test.mjs     # add TEST_AI=1 to also generate a real study
```

`.env.local` needs `SUPABASE_URL`, `SUPABASE_KEY` and `GEMINI_API_KEY` (see `.env.example`).

## Android

Needs JDK 21 and Android SDK 36.

```
npm ci
npm run build                 # API address defaults to https://mychurchbiblestudy.com in the phone apps
npx cap sync android
cd android
./gradlew bundleRelease       # app/build/outputs/bundle/release/app-release.aab  (Google Play)
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk     (install directly)
```

Signing: `android/keystore.properties` (not in git) points at the upload keystore. Both live outside the
repository. **Never create a new keystore for this app.** An update signed with a different key cannot be
installed over the old one, and Google Play will refuse it. Back the keystore up somewhere safe.

Before each store upload raise `versionCode` (and `versionName`) in `android/app/build.gradle`.

Testing against a server on your own computer with an emulator:

```
API_BASE_URL=http://10.0.2.2:8080 npm run build
CAP_DEV=1 npx cap sync android
cd android && ./gradlew assembleDebug
```

Run a normal `npm run build && npx cap sync android` again before any release build.

## iOS (on the Mac)

Nothing iOS has been compiled yet. The project and the Swift recorder were written on Linux.

1. Install Xcode (current version) and Node 22 or newer. Sign in to Xcode with the Apple Developer account.
2. `npm ci && npm run build && npx cap sync ios`
3. `npx cap open ios`. Xcode fetches the Swift packages on first open.
4. Target App > Signing & Capabilities: pick the team. Bundle id is `com.mychurchbiblestudy.app`.
   Add the capabilities **Background Modes > Audio** (already in Info.plist), **Associated Domains**
   with `applinks:mychurchbiblestudy.com`, and **Sign in with Apple**.
5. Build to a real iPhone and check, in this order:
   - the recorder: start, lock the phone for a few minutes, take a phone call, finish. The file should cover the whole time
   - sign in with Google returns to the app
   - daily reminder arrives with the app closed
   - camera and photo picker on Scan Notes
6. Archive and upload to TestFlight from Xcode.

Sign in with Apple also needs the Apple provider switched on in Supabase (Authentication > Providers) with a
Services ID and key from the Apple Developer account. The button is already in the app and only shows on iPhone.

## Still to do before the stores

- A working Gemini key on the server, and a new key to replace the old one (the old one shipped inside the public web bundle).
- Privacy policy, terms and support pages live on the domain, with a real support email.
- Store listings, screenshots, privacy forms, age rating.
- Someone who reads `content_reports` (reports made in the app land in that table).
- Push notifications (study ready, comments) are not built. They need a Firebase project and an Apple push key.
