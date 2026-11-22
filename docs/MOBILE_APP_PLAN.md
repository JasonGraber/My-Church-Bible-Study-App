# My Church Bible Study: plan for the Android and iOS apps

Written 2026-11-22 from a full read of this repo at commit `5dfa446`.

## Status on 2026-11-22 (later the same day)

Done and checked:

- **Phase 1, backend.** Every AI call now runs on the server behind sign-in and a daily quota. The key is out of the web bundle. Access rules were rewritten and applied to the live database, with 14 automated checks using two throwaway accounts. Tailwind is bundled. Dead files are gone.
- **Phase 2, recording on Android.** Our own recorder plugin. On an emulator it kept recording for 20 seconds with the app in the background and the screen off, uploaded to private storage, and kept the copy on the phone when study creation failed.
- **Phase 3, Android app.** Capacitor project, signed release APK and Play bundle. Reminders use the phone's scheduler. Native share sheet, calendar handoff, sign-in return link, back button.
- **Phase 4 in the app.** Delete account (tested on the emulator), report and block, AI notice, recording consent notice, updated privacy and terms screens.

Not done or not checked:

- **Study generation end to end.** No working Gemini key was available on the build machine, so the server's AI calls have not been run since the rewrite.
- **The server is not deployed.** The old Cloud Run address returns 404.
- **iOS.** Project and Swift recorder are written but have never been compiled. See `docs/RELEASING.md`.
- **A real phone.** Everything above was on an emulator.
- Push notifications, offline reading of saved studies, Sign in with Apple setup, store listings.

The rest of this document is the original plan.

## The short version

- **Approach:** keep the React app and wrap it with Capacitor. One codebase ships to the web, the Play Store and the App Store. A rewrite in React Native or Flutter would throw away about 5,900 lines of working screens to get to the same place.
- **Three things block a store release today**, and none of them are about packaging:
  1. The Gemini API key is compiled into the browser bundle (`vite.config.ts` defines `process.env.API_KEY`; `services/geminiService.ts` calls Gemini from the client). Anyone can pull it out of the app and spend on it.
  2. The database lets any signed-in or anonymous client read every user's studies, progress, and profile, including email (`supabase/migrations/002_rls_policies.sql`: `using (true)` on `profiles`, `studies`, `study_participants`, `study_day_progress`, `study_day_comments`).
  3. Store rules the app does not meet yet: in-app account deletion, report and block for community posts, Sign in with Apple next to Google sign-in, and a privacy policy that matches what the app does (the current one says data stays on the device, which stopped being true when Supabase was added).
- **The feature that makes it worth being a native app does not exist yet:** recording the sermon live. The web app only uploads an audio file (`views/RecordView.tsx` has a file input, no recorder). Recording 45 minutes with the screen locked is the hardest piece of the project and is the first thing to prove.
- **Order of work:** fix the backend, prove background recording, wrap and build the native features, add the store-required features, then test and submit. Android can reach testers first. iOS needs a Mac or a cloud build service and an Apple Developer account.

## What exists today

| Area | State |
|---|---|
| Stack | React 19, Vite 6, TypeScript, Tailwind loaded from a CDN, Supabase (auth and Postgres), Express server on Cloud Run |
| Study creation | Upload audio, photograph notes, paste text, or give a YouTube link. Gemini returns a 5 or 7 day study: topic, passage, supporting verses, devotional, reflection question, prayer focus |
| Study settings | 5 or 7 days; 5, 15 or 30 minute readings; number of supporting verses |
| Study together | Join a friend's study, per-day progress, comments on each day |
| Community | Feed of study shares, prayer requests and testimonies; likes, comments, friends, profiles |
| Events | Photograph the bulletin, Gemini extracts events, export to calendar as `.ics` |
| Church | Search for a home church (server endpoint using Gemini with Google Maps), service times, "you are here" check within 200 m |
| Reminders | Browser notification on a `setTimeout`. Only fires while the tab is open |
| Sign-in | Email and password, Google OAuth (Supabase) |
| Server | `server.js`: static files, `/api/transcript` (YouTube), `/api/church/search` |

Other things found while reading, to fix along the way:

- `index.html` links `icon-192.png`, which is not in `public/`. The manifest uses an emoji SVG as the icon. The apps need a real icon set.
- Shared study links point at `https://mychurchbible.app/share/<id>` (`views/StudyDashboard.tsx:176`). That domain does not resolve.
- `db_schema.sql`, `schema.prisma` and `supabase_schema.sql` are empty files. `services/apiConfig.ts` is unused.
- Audio and images go to Gemini as base64 inside the request. That has a size ceiling a full sermon recording can exceed.
- The models are preview names (`gemini-3-pro-preview`, `gemini-3-flash-preview`) hard-coded in the client. Preview models get retired; the model name should live on the server.

## Why Capacitor

| Option | What it means | Verdict |
|---|---|---|
| **Capacitor** | The existing React app runs inside a native shell. Native features come from plugins, plus small pieces of Kotlin and Swift where plugins fall short | **Recommended.** Reuses every screen. The UI is already phone-shaped (bottom nav, portrait, full-height views) |
| React Native / Expo | Rewrite every view in native components | Better feel on long lists and gestures, but months of rework for an app whose screens are mostly reading text |
| Two native apps | Kotlin and Swift separately | Twice the work, two codebases to keep in step |
| Play Store wrapper around the website (TWA) | Android only, no real native features | Does not solve recording or reminders, and nothing for iOS |

Risk with Capacitor: Apple rejects apps that are only a website in a wrapper (guideline 4.2). Live recording, real notifications, the camera and share sheet, and offline reading of saved studies are what make this an app. They are in the plan for that reason too.

## Phase 0: decisions and accounts (Jason)

- Apple Developer Program, $99 per year. Enrolling as an organization needs a D-U-N-S number and takes longer than enrolling as an individual; the seller name shown in the App Store follows that choice.
- Google Play Console, $25 once. A new personal account must run a closed test with at least 12 testers for 14 days before it can publish to production. An organization account skips that.
- App name in the stores, bundle ID (suggest `com.mychurchbiblestudy.app`), and the domain. `mychurchbible.app` (used in the code) is not set up. `mychurchbiblestudy.com` resolves to a Google address and returns a 404, so it may already be yours.
- A support email address. Both stores require one, and so do the privacy policy and the report-abuse path.
- Free, paid, or church-sponsored. This shapes Phase 4. If people pay inside the app, Apple and Google both require their own billing.
- How iOS gets built. It needs macOS. Options: the Mac mini Cody runs on, a cloud build service, or a GitHub Actions macOS runner.

## Phase 1: backend hardening (must land before any store build)

1. **Move all Gemini calls to the server.** New endpoints on the existing Express service: create a study, process a bulletin. The server checks the Supabase session token on every `/api/*` call. Remove the key from `vite.config.ts` and rotate it, since the current key has shipped in a public bundle.
2. **Make study creation a job.** The app uploads the audio to private Supabase Storage, creates a `studies` row with status `processing`, and the server picks it up, sends the file to Gemini through its file upload API, and writes the result. The app can be closed while this runs; a push notification says when the study is ready.
3. **Rewrite the access rules.** Profiles: name and avatar readable by signed-in users, email only by the owner. Studies: owner, participants, and people opening a share link. Progress and day comments: participants of that study. Move `friends` out of an array on the profile into its own table so one user cannot edit another's list. Add tests that try to read another account's data and expect to fail.
4. **Rate limits and per-user quotas** on study creation, church search and transcripts, so one account cannot run up the Gemini bill.
5. **Delete-account endpoint** that removes the auth user, rows and stored audio.
6. **Bundle Tailwind at build time** instead of loading it from the CDN. The app must start with no network.
7. Delete the empty schema files and the unused config.

Done when: the built bundle contains no API key, a second test account cannot read the first one's studies or email, and a study can be created end to end through the server.

## Phase 2: prove background recording (spike, before committing to the rest)

Question to answer: can the app record a 45 to 60 minute sermon with the screen off, survive a phone call or an app switch, and produce a file small enough to upload on church Wi-Fi or cellular?

- Android: a foreground service of type microphone with a visible "Recording" notification.
- iOS: the audio background mode with an active recording session.
- Target format: mono AAC around 32 kbps, roughly 14 MB per hour.
- Write to disk as it records, so a crash or a dead battery keeps what was captured.
- Try the community recording plugins first. If they do not hold up in the background, write a small plugin (about a file each in Kotlin and Swift).

Test on a real Pixel and a real iPhone, not only emulators. If iOS hardware is not available yet, the Android half still answers most of the question.

## Phase 3: the native apps

| Web today | In the apps |
|---|---|
| Upload an audio file | Live recorder with pause, resume, elapsed time and level meter (the existing `AudioVisualizer` component is the start of this). File upload stays as a second option |
| File input with `capture` | Native camera and photo picker for notes and bulletins |
| `setTimeout` reminder | Local notifications scheduled on the device: daily study time, and Sunday before the saved service time ("Record today's message?") |
| None | Push notifications: study ready, friend joined your study, comment on your day |
| Google OAuth redirect | Native Google sign-in and Sign in with Apple, both through Supabase |
| `navigator.share` | Native share sheet |
| `.ics` download | Add the event straight to the phone's calendar |
| Share link to a dead domain | Universal links and Android app links on the real domain; the link opens the study in the app, or the website if the app is not installed |
| Online only | Saved studies cached on the device and readable offline; progress syncs later |
| Location check when the screen is open | Keep "while using the app" only for v1. A true geofence needs "always" location, which Apple reviews hard and users distrust. The Sunday service-time notification covers the same need |

Also in this phase: app icon and splash screen, safe-area and keyboard handling, Android back button, light haptics, and separate dev and production configurations.

## Phase 4: what the stores require

- **Account deletion inside the app** (Apple 5.1.1, Google Play), plus a web page where someone can request deletion without the app (Google Play).
- **Community safety** (Apple 1.2, Google Play user-generated content): report a post or comment, block a user, a terms screen that forbids abuse, and someone who reviews reports. Decide who that is.
- **Sign in with Apple** on iOS, because Google sign-in is offered (Apple 4.8).
- **Privacy policy rewritten** to match the real data flow: account data and studies in Supabase, audio and images sent to Google for processing, location used on the device. A draft is in `website/privacy.html`.
- **Store privacy forms**: Apple's privacy labels and Google's data safety form, filled in from that same list.
- **Permission wording** for microphone, camera, photos, notifications and location that says plainly why each is asked.
- **AI disclosure**: the terms already say studies are AI-generated and should be checked against Scripture and church leadership. Show that in the app where a study is created, not only in the terms.
- **Recording consent**: a one-time note that the user should have the church's permission to record. Worth asking Pastor Steve how ALC wants this handled before launch.
- **Age rating** questionnaires. With an open community feed the app is not for children under 13.
- **Payments**, only if the Phase 0 answer is "paid".

## Phase 5: testing and release

1. Internal builds to Jason and Michelle (Play internal testing, TestFlight).
2. Closed beta with a small group from church. This doubles as the 12-tester, 14-day run if the Play account is personal.
3. Store listing: name, short and long description, screenshots for each phone size, feature graphic, support and privacy URLs. The marketing site in `website/` supplies the URLs and most of the copy.
4. Submit. Expect questions from Apple review on the first submission; plan for at least one round.
5. Release to a percentage of Android users first, then everyone.

Add crash reporting and basic usage counts before the beta, so problems show up without waiting for someone to report them.

## Rough size

With no surprises in the recording spike: Phase 1 about a week of focused work, Phase 2 two to three days, Phase 3 two to three weeks, Phase 4 one to two weeks, Phase 5 two to three weeks of calendar time, most of it waiting on testers and review. These are estimates, not measurements. The recording spike and Apple review are where they are most likely to slip.

## Risks

| Risk | Handling |
|---|---|
| Background recording is unreliable on one platform | Phase 2 exists to find this out first. Fallback is a small native plugin |
| Apple calls it a wrapped website | Recorder, notifications, offline reading and native sign-in are real native behavior; say so in the review notes |
| Gemini cost per sermon | Compress audio on the phone, set per-user quotas, log cost per study from day one |
| AI gets theology or a reference wrong | Visible disclosure, links to the passage (already there via bible.com), and a "report a problem with this study" button |
| Copyright on sermons and YouTube videos | Terms put the responsibility on the user (already there); studies are private by default |
| Moderating the community feed | Report and block at launch. If nobody can own moderation, ship v1 with friends-only sharing and open the public feed later |

## After launch

Home-screen widget with today's passage, lock-screen recording controls, a church admin view where a pastor publishes one study for the whole congregation, and Spanish.
