# WAFINA RC1 — Freeze & Audit (Phase 0)

**Date:** 2026-08-11
**Prepared by:** Claude, as Release Manager, per the "WAFINA RC1 — Master Launch Plan" brief.
**Scope:** read-only inspection. No code changed, nothing committed, nothing built/submitted as part of this
task — all facts below are freshly verified against the real repo, EAS account, and running config, not
recalled from memory or copied from prior docs without re-checking.

This audit cross-checks the existing release documentation (`RC1_RELEASE_ROADMAP.md`,
`PRODUCTION_READINESS_REPORT.md`) against the actual current state, since several things have shipped since
those docs were last updated that they don't reflect.

---

## 1. Current State

### Git
- Branch: `main`, HEAD `7351d56` ("fix: use logo pink for sign-in tagline and Criar Conta link").
- **Working tree is clean.** No uncommitted changes of any kind — the A/B/C/D risk categorization the brief
  asked for is moot this session; there's nothing pending to categorize.
- Last 10 commits are all RC1-track work: the RECEBER individual-pickup feature, the Admin donation-approval
  gate, Animal Shelter role, Admin donations UX/translation overhaul, and today's sign-in color fix.

### Apps in the repo
Five apps + two shared packages, one npm workspace:
- `apps/mobile-donor` — Wafina Doador (iOS + Android, Expo)
- `apps/mobile-institution` — Wafina Instituição (iOS + Android, Expo)
- `apps/web` — Donor web
- `apps/institution` — Institution/Shelter web
- `apps/admin` — Admin web (staff-only, not store-distributed)
- `apps/api` — backend (Express + Google Sheets/Drive + Firebase Admin)
- `packages/shared`, `packages/ui` — shared types/enums/components across all five apps

### Bundle identifiers / package names
| App | iOS bundle ID | Android package | EAS project ID | ASC App ID |
|---|---|---|---|---|
| Wafina Doador | `com.zuinder.wafina.doador` | `com.zuinder.wafina.doador` | `e29746ed-...` | `6799295890` |
| Wafina Instituição | `com.zuinder.wafina.instituicao` | `com.zuinder.wafina.instituicao` | `0a4405fe-...` | `6799314448` |

Both consistent between `app.json` and `eas.json`, matching the registered developer entity
(ZUINDER, LDA.) per `RC1_RELEASE_ROADMAP.md` Phase 3.

### Versions / build numbers
- `package.json` and `app.json` `version` is `0.0.1` for **all six** workspaces (apps + api) — never bumped.
- `eas.json` uses `"appVersionSource": "remote"` — EAS tracks build numbers server-side, not in `app.json`.
- **iOS**, current state on EAS (not necessarily what App Store Connect/TestFlight shows yet — Apple's own
  processing lags the upload):
  - Wafina Doador: build **6**, commit `7351d56`, submitted today, `FINISHED` on EAS's side, Apple processing.
  - Wafina Instituição: build **5**, commit `7351d56`, submitted today, `FINISHED` on EAS's side, Apple processing.
- **Android** — see §5, this is a real finding: builds exist but are stale and undocumented in the roadmap.

### Expo / React Native
- Expo SDK `57.0.10`, React Native `0.86.2`, React `19.2.3`.
- **Managed workflow — no native `android/` or `ios/` folders in the repo.** EAS Build does the
  prebuild step remotely on every build.

### Icons / splash
- Both apps have `icon.png`, `adaptive-icon-foreground.png`, `icon-mark.png`, `splash-mark.png` present and
  wired into `app.json` (`expo-splash-screen` plugin, light/dark variants).
- Per `RC1_RELEASE_ROADMAP.md` Phase 6, these were frozen 2026-08-03 under a "D/I/A badge system" brand
  identity, then the whole visual system was redesigned again 2026-08-07 ("Wafina Brand Identity Redesign,"
  logo/colors/typography/splash/auth/nav/icons — see memory `wafina-brand-identity-redesign`). **Whether the
  current on-disk icon assets reflect the 2026-08-03 freeze or the 2026-08-07 redesign wasn't re-verified
  visually in this pass** — worth a quick look before Phase 4 (Icon System) of the new plan, so we're not
  redesigning icons that were already redone three weeks ago.
- The two apps' icons are **not yet visually distinguishable by a donation-vs-institution cue** — both use
  the same `icon-mark.png`/`splash-mark.png` files, differentiated today only by `adaptiveIcon.backgroundColor`
  (`#710f44`, identical on both, so not even that differs) and app name. This is the real gap the brief's
  Phase 4 is asking about — not a false alarm.

### EAS configuration
Both apps have identical shapes: `preview` (internal, Android `apk`) and `production` (Android `apk`, iOS
`distribution: store`) build profiles, plus a `submit.production.ios.ascAppId`. Both profiles' `env` block
hardcodes the production API URL and Firebase web config directly in `eas.json` (see §2 — this is
intentional and already reasoned about, not a fresh leak).

**Finding:** the `production` profile's Android `buildType` is `"apk"`, not `"aab"`. Google Play's
production track requires an **AAB**, not a raw APK, for a new app. Despite this, the two Android builds
that exist (§5) *are* `.aab` artifacts — meaning either the profile was overridden at build time, or the
profile has changed since that build. This needs reconciling before any new Android build is triggered for
Play Store submission (see Phase 1 report / Risks below).

### Environment variables
- No `.env`/`.env.local` file is tracked in git anywhere (`git ls-files | grep .env` → empty) — `.gitignore`
  correctly excludes them. Only `.env.example` files (no real values) are tracked, one per app that needs one.
- Mobile apps don't use `.env` files for production builds at all — `eas.json`'s `env` blocks are the actual
  source of truth for `EXPO_PUBLIC_*` vars baked into EAS builds. Local `.env` files in
  `apps/mobile-{donor,institution}/` exist only for local Expo Go dev.
- Local dev `.env.local` files for the three web apps correctly point at `http://localhost:4000` — this is
  expected and correct for local dev; the actual Render deploys use Render's own dashboard-configured env
  vars (already verified live in a prior session — see `RC1_RELEASE_ROADMAP.md` Phase 2).

### API URLs / Firebase
- Every EAS build profile (`preview` **and** `production`) for both mobile apps points at
  `https://wafina-api-rd0q.onrender.com` — the real production API, not localhost, not a preview/staging
  URL. No dev/staging Firebase project exists — there's exactly one Firebase project
  (`wafina-98a3a`) used everywhere, dev and prod alike, confirmed identical across mobile `eas.json` and all
  three web apps' `.env.local`/Render config.
- The mobile app's local-fallback `'http://localhost:4000'` in `src/lib/api.ts` only fires if
  `EXPO_PUBLIC_API_BASE_URL` is unset — confirmed it's always set in both EAS profiles, so this fallback
  never activates in a real build. It's a dev convenience, not a production risk.

### Notifications
- **No push notification integration exists.** `expo-notifications` is not a dependency in either mobile
  app's `package.json`. Notifications today are in-app only (an Admin-driven Notification Engine writing to
  Sheets, surfaced in-app) — already documented this way in the published Privacy Policy. Nothing to audit
  here that isn't already accurately described to users.

### Permissions (iOS `Info.plist` via `app.json`)
- Both apps: `NSLocationWhenInUseUsageDescription` (Portuguese, purpose-specific), `ITSAppUsesNonExemptEncryption: false`.
- Donor: `NSPhotoLibraryUsageDescription`.
- Institution: `NSPhotoLibraryUsageDescription` **and** `NSCameraUsageDescription` (institution can take
  photos directly for Success Stories — donor cannot, gallery-only, matching the readiness report's earlier
  note that donation/story photo pickers are gallery-only where camera isn't declared).
- All descriptions are purpose-specific, in Portuguese (the app's primary language), no generic boilerplate.

### Permissions (Android, via `app.json`)
- Both apps: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` only. No storage, camera, or contacts
  permissions declared (Expo's `expo-image-picker`/`expo-file-system` handle photo access via the system
  picker without needing broad storage permissions on modern Android).

### Deep links / universal links
- **None configured.** No `scheme` in either `app.json`, no `associatedDomains`, no Android `intentFilters`.
  Consistent with the Privacy Policy and readiness report — this was never built. Not a gap unless the new
  plan intends to add it (out of scope for Feature Freeze unless explicitly approved).

### Analytics / third-party SDKs
- Full dependency list for both mobile apps checked directly. No analytics, ads, crash-reporting, or
  tracking SDK of any kind (`grep` for analytics/admob/facebook-sdk/amplitude/mixpanel/segment/
  crashlytics/sentry across all `package.json` files — zero matches). Matches `COMPLIANCE_INFORMATION.md`'s
  existing claims, re-verified fresh rather than trusted blindly.
- Real dependencies are exactly what's needed: Firebase (auth only), React Navigation, i18next, Expo's own
  modules (file-system, font, image-picker, location, splash-screen, status-bar). Nothing unexpected.

### Authentication
- Firebase Auth (email/password only) for identity; every protected API route re-verifies the Firebase ID
  token and re-fetches the caller's row from Sheets fresh on every request (already documented and
  security-reviewed in `PRODUCTION_READINESS_REPORT.md` §7 — re-confirmed present, not re-derived from
  scratch this pass).

---

## 2. Risks

Ranked by how much they threaten the timeline the brief itself called out (Google Play's Aug 31, 2026 API 36
deadline, 20 days from today):

| # | Severity | Risk |
|---|---|---|
| 1 | **High — time-boxed** | **Android target API level is unverified.** I could not empirically confirm the compileSdkVersion/targetSdkVersion that Expo SDK 57's managed build actually produces — the existing Android build's log file wasn't retrievable in a parseable form from this environment, and the number isn't hardcoded anywhere greppable in the local `node_modules` tree (it lives in Expo's remote prebuild template, applied at EAS build time, not in this checkout). This must be resolved empirically (rebuild and inspect the real Gradle output, or check Expo's official SDK 57 release notes) before treating any Android build as submission-ready. Given the Aug 31 deadline, this should be the very first thing checked in Phase 1, not left for Phase 9/13. |
| 2 | Medium | **`eas.json`'s production Android profile specifies `buildType: "apk"`**, not `"aab"`. Google Play requires an AAB for a new app's production track. The existing Android builds *are* AABs, so something already overrides this — needs reconciling so the *next* Android build behaves the same way deliberately, not by accident. |
| 3 | Medium | **Neither mobile app has ever been submitted to Google Play Console.** Store listing copy is drafted (`STORE_LISTING_COPY.md`) but Store Listing / Data Safety / Content Rating have not been submitted in-console (per the roadmap's own Phase 3 status). |
| 4 | Medium | **Google Play's 12-tester/14-day closed-testing requirement for new personal developer accounts is unverified.** I have no Play Console access from this environment — this needs the stakeholder to check the account's actual status directly, per the brief's own "do not assume" instruction. |
| 5 | Medium | **`RC1_RELEASE_ROADMAP.md` is meaningfully stale.** It shows Phase 4 (Release Builds) as entirely `⬜ not started`, but iOS TestFlight builds have shipped multiple times (donor builds 4/5/6, institution builds 3/4/5) and both apps already have a successful Android AAB build from 2026-08-05. It also predates the entire RECEBER feature, Admin approval gate, Animal Shelter role, and the 2026-08-07 brand redesign. Before using it as the plan of record, it needs a refresh pass — otherwise this new 15-phase plan and the old roadmap will drift out of sync with each other. |
| 6 | Low — cost | **EAS build credits are at 80%** for this billing period (surfaced live during today's builds). Both remaining store submissions will need at least one more Android build each, plus however many iOS/Android rebuilds QA turns up. Worth budgeting deliberately rather than rebuilding reactively. |
| 7 | Low | **No automated test suite** (already tracked as the #1 item in `PRODUCTION_READINESS_REPORT.md`'s Top 10). All verification to date is manual/live QA — thorough, but with no regression safety net. |
| 8 | Low | **App icons are not yet visually distinguishable by a donation-vs-institution cue** — both apps currently share the same mark and adaptive-icon background color. This is exactly what Phase 4 of the new plan is meant to fix, flagged here so it's not mistaken for an oversight already covered by the 2026-08-03/08-07 brand work. |

---

## 3. Blockers

Nothing here blocks *further prep work* — these block an actual store submission specifically:

- **Apple:** App Store Connect app records exist and builds are uploaded (via `ascAppId`), but full listing
  prep — screenshots, description, age rating, privacy nutrition label, review notes, support/marketing URLs
  — has not been submitted in-console (`RC1_RELEASE_ROADMAP.md`: "⬜ Configure Apple App Store Connect").
- **Google:** Store Listing / Data Safety / Content Rating not submitted in-console; Android target-API
  question (Risk #1) unresolved; AAB build-profile question (Risk #2) unresolved; closed-testing account
  status (Risk #4) unverified.
- **Both:** no store screenshots exist yet for either platform. The roadmap already notes why: screenshot
  capture requires an authenticated, signed-in device session, which I don't do on the stakeholder's behalf —
  this is a hard rule, not a scheduling gap. Workable path already agreed in the roadmap: the stakeholder
  captures raw screenshots from a signed-in device, I add framing/captions/consistent branding.
  - Note: real-device testing has happened this project (RECEBER was live-tested via Expo Go on a real
    Android phone per session history) — the blocker is specifically *authenticated screenshot capture*,
    not device access in general.
- **Both:** no dedicated review/demo accounts exist yet for either store's reviewers (Phase 10 of the new
  plan) — today's disposable test accounts are created-and-deleted per session, not standing demo accounts.

---

## 4. Unfinished Features (already known, not new findings)

Carried forward from `PRODUCTION_READINESS_REPORT.md`, all explicitly deferred to `VERSION_2_ROADMAP.md`
under the Feature Freeze — listed here only so nothing below is mistaken for something this audit newly found:
- Admin: donation edit/cancel, per-country statistics rollup, suspend-a-verified-institution.
- Reports: date-range/status filtering, charts, scheduled/emailed reports.
- Corporate Accounts: logo upload.
- No automated test suite (Risk #7 above).

---

## 5. Android Build — Correction to the Roadmap

This is a concrete finding, not a restatement: **both apps already have a successful, store-distribution
Android AAB build**, dated 2026-08-05 — `RC1_RELEASE_ROADMAP.md` Phase 4 lists Android AAB as `⬜ not
started`, which is incorrect.

| App | Build ID | Status | Distribution | Date |
|---|---|---|---|---|
| Wafina Doador | `f8246eee-...` | `FINISHED` | STORE (.aab) | 2026-08-05 |
| Wafina Instituição | `123cedd3-...` | `FINISHED` | STORE (.aab) | 2026-08-05 |

**These builds are stale and should not be treated as the current release candidate** — they predate every
commit made in this session (including the RECEBER lifecycle-email/Admin-UX work in `79a1bcc` and today's
color fix in `7351d56`) and, per Risk #1, their actual target API level hasn't been confirmed against the
Aug 31 deadline. A fresh Android build against current `main` will be needed regardless, once Risks #1 and
#2 are resolved.

---

## 6. Required Decisions (need the stakeholder — not mine to pick)

1. **Which store to push toward completion first?** Apple already has builds moving through TestFlight
   processing; Google Play has the harder external deadline (Aug 31). Recommend Google Play first given the
   clock, but this is a business call, not a technical one.
2. **Confirm the Android `eas.json` `buildType` fix** (`"apk"` → `"aab"` for the production profile, or
   leave as-is if there's a reason it's intentionally APK and the AAB builds were one-off manual overrides)
   before the next Android build is triggered.
3. **Treat `RC1_RELEASE_ROADMAP.md` as the plan of record**, refreshed to reflect reality, rather than
   running two parallel tracking docs (the old roadmap and this new 15-phase plan) that will drift apart.
   Recommend folding this new plan's remaining phases into the roadmap's existing Phase 3/4/6/7 structure.
4. **Has the stakeholder already checked Play Console for the 12-tester/14-day closed-testing
   requirement?** I have no console access — this needs to happen before Phase 13 either way, might as well
   happen now given the deadline pressure.
5. **Icon differentiation direction** (Phase 4 of the new plan) needs the stakeholder's sign-off on a
   proposed visual direction before any asset work — per the brief's own instruction not to finalize icons
   without approval, and per Risk/Blocker above, current icons don't yet differentiate Donor from
   Instituição.

---

## 7. Release Candidates (current, as of this audit)

| App | Platform | Build | Status |
|---|---|---|---|
| Wafina Doador | iOS | build 6, commit `7351d56` | Uploaded to App Store Connect, Apple processing |
| Wafina Instituição | iOS | build 5, commit `7351d56` | Uploaded to App Store Connect, Apple processing |
| Wafina Doador | Android | build from 2026-08-05, commit predates `79a1bcc`/`7351d56` | **Stale** — not representative of current `main`, never submitted to Play Console |
| Wafina Instituição | Android | build from 2026-08-05, commit predates `79a1bcc`/`7351d56` | **Stale** — same as above |

---

## 8. Recommended Freeze Point

**`main` @ `7351d56`** is a reasonable freeze point for the remainder of this launch-prep effort:

- Working tree is clean — nothing uncommitted, nothing to triage into "intended vs. risky."
- The last substantial feature work (RECEBER lifecycle emails, Admin donations UX/translation overhaul,
  `79a1bcc`) was already regression-tested end-to-end earlier this session before being committed and pushed.
- Today's only change on top of that (`7351d56`) is a small, isolated, already-typechecked visual fix
  (sign-in tagline/Criar Conta color) matching an already-tracked bug ticket — low risk, already verified.
- Both iOS builds already reflect this exact commit; only Android needs a fresh build once Risks #1/#2 are
  resolved.

**Recommendation: freeze here.** Any further code changes from this point forward should go through the same
discipline already established this project (Feature Freeze, one phase at a time, explicit approval before
build/submit/deploy) — which the brief itself asks for.

---

## Summary for the stakeholder

Nothing was changed, committed, built, or submitted as part of this audit — it's pure inspection, as
instructed. Headline findings:

1. **The existing `RC1_RELEASE_ROADMAP.md` undercounts real progress** — both platforms have build history
   the roadmap doesn't show (iOS TestFlight builds and Android AABs alike). Worth reconciling before
   treating either doc as authoritative.
2. **The genuinely new, time-sensitive risk is Android's target API level** against Google Play's Aug 31
   deadline — unverified from this environment, needs to be Phase 1's first item, not something to discover
   during Phase 13 submission prep.
3. **The Android EAS build profile's `buildType` doesn't match what was actually built** — needs a quick
   reconciliation before the next Android build.
4. Everything else (production URLs, Firebase config, secrets hygiene, permissions, no analytics/tracking,
   auth architecture) checked clean — consistent with the prior security review, re-verified fresh rather
   than assumed.

**Recommended next step:** Phase 1 (Production Configuration Audit), starting with the Android target-SDK
verification specifically, since that's the one item on a real external clock.
