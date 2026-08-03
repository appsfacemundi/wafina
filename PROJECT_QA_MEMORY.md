# WAFINA V1 PROJECT MEMORY

## Project Overview

Wafina — donation-matching platform connecting individual/corporate donors with verified
institutions (NGOs, orphanages, churches, schools) across Portuguese-speaking African countries.

**Architecture:** Monorepo (npm workspaces).
- `apps/api` — Express backend, single source of truth for all business logic.
- `apps/web` (Donor), `apps/institution`, `apps/admin` — Next.js web apps.
- `apps/mobile-donor`, `apps/mobile-institution` — Expo SDK 57 / React Native 0.86 (New
  Architecture on by default).
- `packages/shared` — shared TS types/enums, built to `dist/` (rebuild after changing).

**Backend:** Google Sheets is the production database (`apps/api/src/config/sheets.ts`,
tab names in `apps/api/src/config/sheet-tabs.ts`). Firebase Auth is the separate identity layer
— client signs in/up with Firebase, then calls `POST /auth/session` with the ID token to
bootstrap/resolve the `Users` row.

**Current version:** Pre-launch, Version 1.0 Feature Freeze in effect — no new functionality,
only bug/security/readiness fixes until launch (see `DEVELOPMENT_RULES.md` §16). Any new feature
ideas go to `VERSION_2_ROADMAP.md`. AppSheet is fully deprecated from the architecture — no new
AppSheet logic/Bots/APIs.

**Project status:** Backend/Web/Admin previously certified production-ready. Android mobile
verification COMPLETE. iOS mobile verification IN PROGRESS (this file tracks it).

---

## Production Status

- **Android:** ✅ Verified production-ready (commit `e4b8707`, recorded `bc486a1`). Donor +
  Institution apps, full donation lifecycle, photo upload, auth flows all live-tested against
  production backend.
- **iOS:** 🔶 IN PROGRESS. Donor app core flows verified this session (see below). Institution
  app verification started but not finished (claim/schedule/collect/deliver/success-story/logo
  upload not yet tested).
- **Web (Donor/Institution/Admin):** ✅ Previously certified.
- **Backend:** ✅ Production-hardened (rate limiting, structured logging, Sheets backup, see
  `ee137f3`).
- **Admin:** ✅ Full feature parity with Donor/Institution (Users, Countries, Disputes,
  Corporate Accounts + invitation codes, Notifications broadcast, Reports) — see commits `52`
  through `57` in git log for the phased build-out.

---

## Completed Modules

- Authentication (sign up / sign in, Firebase + `/auth/session` bootstrap) — Android ✅, iOS
  Donor ✅ (sign-up + suspended-account sessionError path verified live).
- Donation creation + photo upload (`uploadFile()` via `expo-file-system/legacy` uploadAsync) —
  Android ✅, iOS Donor ✅ (real 201, real Drive URL, GPS auto-capture confirmed).
- Institution registration (pending-verification flow) — iOS ✅ (this session).
- GPS/location auto-capture — Android ✅, iOS Donor ✅, iOS Institution ✅ (registration form).
- Camera/photo picker — Android ✅ (photo library only, camera not tested), iOS Donor ✅ (photo
  library only, camera not tested).
- Admin Web full CRUD across Users/Countries/Disputes/Corporate Accounts/Notifications/Reports —
  ✅ (web only, not applicable to mobile).

**Not yet verified on iOS:** Institution claim → schedule → collect → deliver workflow, Success
Story creation with photo upload, Institution logo upload, Notifications (mobile push/in-app),
offline/poor-network behavior on iOS specifically.

---

## Bugs Fixed

| Date | Bug | Root Cause | Files changed | Commit |
|---|---|---|---|---|
| 2026-07-31 | Donation photo upload silently failed on Android (`Unsupported FormDataPart implementation`, then `undefined is not a function` after first fix attempt) | RN 0.86 New Architecture breaks classic `FormData`/`Blob` multipart upload | `apps/mobile-donor/src/lib/api.ts`, `apps/mobile-institution/src/lib/api.ts` (new `uploadFile()` using `expo-file-system/legacy` `uploadAsync`), `DonateScreen.tsx`, `SettingsScreen.tsx`, `NewSuccessStoryScreen.tsx` | `e4b8707` |
| 2026-07-31 | Silent auth failure: a session-resolution error (e.g. suspended account) left the app stuck instead of showing Sign In | `AuthContext`'s `onAuthStateChanged` listener didn't catch/report `resolveSession()` failures | `AuthContext.tsx` + `SignInScreen.tsx` in both mobile apps (added `sessionError` state, `signIn()` rethrow-and-signOut) | `e4b8707` |
| 2026-08-02 | `apps/admin` production build failed: `useSearchParams()` must be wrapped in a Suspense boundary | Never caught before because Admin had only ever been run via `next dev` (no prerendering), never `next build` — this was RC1's first production build attempt for Admin | `apps/admin/src/app/sign-in/page.tsx` (split into `SignInPage` wrapper + `SignInForm` inner component, wrapped in `<Suspense>`) | `01b043b` |
| 2026-08-02 | `wafina-institution-web` Render Static Site served Admin's build under Institution's URL (title "Wafina Admin", empty body, several 404'd JS chunks) | Render service was created with `apps/admin`'s Build Command and Publish Directory instead of `apps/institution`'s — an operator mix-up, not an app code bug | Render dashboard config only (Build Command, Publish Directory corrected) — no repo changes | N/A (deploy config, not code) |
| 2026-08-02 | GitHub Actions CI (`npm run build`) has failed on every single push since the very first commit (2026-07-28) — pre-existing, not introduced by RC1 work. Caught via a GitHub notification email, not by watching CI directly | Firebase client SDK throws `auth/invalid-api-key` during Next.js static-page prerendering (even for auto-generated routes like `/_not-found` that never call Firebase) because CI never had `NEXT_PUBLIC_FIREBASE_*`/`NEXT_PUBLIC_API_BASE_URL` configured — these only ever existed in gitignored `.env.local` files | `.github/workflows/ci.yml` (added an `env:` block to the build step with the real, non-sensitive client config values — Firebase web SDK keys are meant to ship in the bundle) | `e6d5ce5` |
| 2026-08-02 | Stakeholder-reported "critical blocking bug": a donor's new donation never appeared in the Institution app's Available Donations | **CONCLUSIVELY ROOT-CAUSED against real production data — not a code defect.** Full checklist worked through with evidence, not assumption: (1) donation genuinely saved — confirmed real rows in the live `Donations` sheet; (2) `Status` correctly `Pending` immediately after creation; (3) the `/donations/available` query filter is exactly `Status === 'Pending' && Country_ID === institution.Country_ID` — verified by reading the full function body, no hidden logic; (4) no approval/moderation flag exists anywhere in the `Donation` schema; (5) Location/GPS is stored but never used in this filter; (6) no date/time filtering exists in this query; (7) no caching layer exists anywhere in the Sheets read path, and confirmed empirically — a freshly created donation was visible on the very next request. **Direct production data query** (one-off script reading the live `Donations`/`Institutions`/`Geo_Regions` sheets) found the actual real-world instance: the stakeholder's own account (`zuinder@outlook.com`, "Zuzu Yoby") has `Home_Country_ID=Angola` but `Active_Country_ID` had been switched to `Portugal` (via the Settings country-switcher, presumably while testing that feature) — two real donations (`PT-000001`, `PT-000002`) were created while Active Country was Portugal, and **every single verified institution in the system is registered under Angola — zero verified institutions exist in Portugal**, confirmed by listing all institution rows. The donations are correctly, permanently invisible to every institution because there is no institution in that country yet, not because of a filtering bug. Recommended follow-up (not yet implemented, needs stakeholder decision — would be new functionality under the Feature Freeze): warn a donor at donation-creation time if their Active Country currently has zero verified institutions, so this can't silently happen to a real user again. | No code fix needed for the root cause itself (working as designed). Fixed one real, related gap along the way: `apps/institution/src/app/donations/available/page.tsx` empty-state message now names the institution's own country instead of a generic "no donations yet," so a genuine country-coverage gap is no longer indistinguishable from a broken pipeline. | `5b953bf` |
| 2026-08-02 | Business-logic gap (stakeholder-flagged, not a code defect): once a donor linked to a company, *every* donation they ever made afterward counted as corporate — an employee's personal donation from home would incorrectly credit their employer | Corporate attribution was derived at read-time from `Donor_ID → Users.Corporate_Account_ID` (a fixed 1:1 assumption baked into `listDonationsByCorporateAccount`), with no per-donation concept at all. Fixed by storing `Corporate_Account_ID` directly on the `Donation` row (nullable) — the donor now chooses Individual/Corporate per donation; the donor-company link never changes. Recommended and got sign-off on this schema over the stakeholder's own proposed `Donation_Type` enum field: fewer moving parts, and it actually removes the old donor-ID join instead of adding to it. Also clarified with the stakeholder and simplified `/donations/mine` to always return the donor's own donations (dropped the old "company-wide view for corporate donors" branch, which would otherwise have hidden a linked donor's own personal donations from their own list) | `packages/shared/src/types/donation.ts` (new field), `apps/api/src/services/donations.ts` (`createDonation`, `listDonationsByCorporateAccount` simplified), `apps/api/src/routes/donations.ts` (`POST /donations` accepts `isCorporateDonation`, `GET /donations/mine` simplified), `apps/api/src/services/corporate-accounts.ts` (`Donation_Count` fixed to match), `apps/api/src/routes/donor.ts` (new `GET /donor/corporate-account`), `apps/web/src/app/donations/new/page.tsx` + `apps/web/src/app/donations/page.tsx`, `apps/mobile-donor/src/screens/DonateScreen.tsx` + `MyDonationsScreen.tsx`. One-off migration added the `Corporate_Account_ID` column to the live `Donations` sheet. | `2c1dce5` |
| 2026-08-02 | Self-caught during implementation, never shipped: the first pass of donor self-service account deletion cleared `Name`/`Phone` but left `Email` on the anonymized `Users` row | `findUserByEmail` (used by `/auth/session` on every login/registration) matches on `Email` alone — a genuine future re-registration with the same address would have collided with the dead row and been permanently rejected by the `Status !== 'Active'` gate instead of creating a fresh account | `apps/api/src/services/users.ts` (`deleteDonorAccount` now also clears `Email`) — caught by testing the fix's actual re-registration path (via `findUserByEmail`) before committing, not just testing the delete call in isolation | same commit as the account-deletion feature, QA Progress table below |
| 2026-08-03 | Every EAS Android build for `wafina-donor` failed at the "Bundle JavaScript" phase with a generic, unhelpful "Unknown error" message | `packages/shared` ships compiled output from `dist/`, but nothing built it on a clean checkout before Metro tried to bundle the app — `dist/` simply didn't exist yet. The real error (`Unable to resolve module @wafina/shared ... dist/index.js ... none of these files exist`) was only visible by running `eas build --local`, which surfaces full error output instead of EAS's generic cloud message | `apps/mobile-donor/package.json` (new `eas-build-post-install` hook: `cd ../../packages/shared && npm run build`, EAS's supported post-dependency-install hook). Also removed `resourceClass: "large"` + its `NODE_OPTIONS` env override from `apps/mobile-donor/eas.json`'s production profile — that resource class requires a paid EAS plan not subscribed to, which was blocking cloud builds independently of the bundling bug | `6dca017` |
| 2026-08-03 | **CRITICAL, caught after the previous cloud-build fix (`6dca017`) was already recorded PASS**: build `502cdd66` compiled and produced a downloadable AAB successfully, but was completely non-functional on a real device — Firebase Auth was totally unconfigured and the API base URL pointed at `localhost`. Cloud-build success and green CI do not exercise `EXPO_PUBLIC_*` env-var resolution at all, so this was invisible to every check performed until this was specifically investigated | Root-caused via mechanism trace through the installed tooling, not guesswork: `babel-preset-expo`'s `inline-env-vars.js` bakes `process.env.EXPO_PUBLIC_*` into the JS bundle as literal values at build time (`path.replaceWith(t.valueToNode(process.env[key]))`), sourced from `@expo/env`'s `.env`-file loader plus any EAS-injected env vars. None of EAS's three injection channels had real values for this build: `eas.json` had no `env` block, EAS's own build log confirmed zero configured Environment Variables for "production", and `apps/mobile-donor/.env` (gitignored) was correctly excluded from the build archive. Confirmed empirically by downloading the actual shipped AAB and byte-searching the extracted Hermes bundle (ASCII + UTF-16LE): the real Firebase key/project ID were **absent everywhere** (0 occurrences), while `api.ts`'s hardcoded `'http://localhost:4000'` dev fallback **was** present — a known-good control string proving the search method wasn't producing a false negative. Net effect: `firebaseConfig` shipped as `{apiKey: undefined, authDomain: undefined, projectId: undefined, appId: undefined}` (likely crash on launch, since `initializeAuth` runs at module-import time), and the API client fell back to `http://localhost:4000` → mangled by the Android-only `10.0.2.2` rewrite → unreachable on any real device | `apps/mobile-donor/eas.json` — added a `production.env` block with the same Firebase/API values already live and verified everywhere else in this platform (byte-for-byte identical to `.github/workflows/ci.yml`'s production config for the three web apps — single Firebase project, single backend, used identically across every client). Re-verified with a brand-new cloud build (`b6c977c7`) and the identical byte-search technique: all five real values now present exactly once each, `localhost:4000` now 0 occurrences | `cde858c` |

---

## Remaining Bugs

| Priority | Description | Module | Status |
|---|---|---|---|
| Low / Unconfirmed | Donor Home screen "Sair" (sign out) button did not respond to 7+ tap attempts (varied coordinates, `tap` and `touch_path`) during iOS Simulator automation. The underlying `signOut(firebaseAuth)` call itself IS verified working (proven via the suspended-account forced-signout test, which hit the exact same code path and correctly landed back on Sign In with the error banner). This may be a simulator-automation tap-registration artifact rather than a real app bug — every other button on the same screen/app responded normally. **Needs a live human tap test on a real device or fresh simulator session to confirm or refute before treating as a real bug.** | Donor mobile (iOS) | Unconfirmed, not fixed |
| Medium / Unconfirmed | Institution `SignUpScreen` "Criar conta" button produced **zero server signal** (no `POST /auth/session`, ever) across 5 consecutive attempts this session — including after a full component state reset (navigated to SignIn and back, confirming empty fields) with a short, cleanly-typed email/password. Unlike the email-field typing quirk (below), this specifically means the button press itself may not be registering, OR Firebase's `createUserWithEmailAndPassword` is silently failing/hanging client-side with no visible error (not confirmable without a screenshot, which was intentionally not spent here per stakeholder direction to stop and preserve the finding instead of continuing to guess). Institution's own "Sair" button, by contrast, DID work correctly on the first tap this same session (see Session Notes) — so this is not the same broad class of issue as the Donor "Sair" bug; it appears specific to `SignUpScreen`'s submit path. **Needs a live human/device retest of Institution sign-up specifically before treating as a real app bug.** | Institution mobile (iOS) | Unconfirmed, not fixed — blocked further progress on direct logo-upload-path testing this session |

---

## Known Technical Decisions

- **iOS Simulator automation quirks (tooling, not app bugs):**
  - The `@` character sometimes renders as `"` or as a bare digit (e.g. `2`) when typed via the
    simulator control tool — this is a modifier-key race condition in the tool itself (confirmed
    independent of both the Mac's keyboard layout and the simulated device's own keyboard
    settings). It is probabilistic — simply retrying the same `@` keystroke until it renders
    correctly works reliably.
  - Multi-character strings occasionally drop characters mid-string (a separate, unrelated
    race). Work around by re-typing the missing suffix after checking a screenshot.
  - Tap/swipe coordinates for this tool are in **device points**, not screenshot pixels. For the
    iPhone 17 Pro Max, device space is 440×956pt; screenshots render at roughly 2.09× that, so
    divide any pixel measurement read visually by ~2.09 before passing to `tap`/`swipe`.
  - Clipboard paste via `simctl pbcopy` + long-press-menu does NOT work through this automation
    tool (the system paste popover doesn't respond to synthetic taps) — don't rely on it as a
    workaround for the `@` issue; retry-typing is the reliable method.
- Google Sheets has real rate limits — hit once during rapid test traffic earlier in the
  project. Avoid large automated batch operations against it.
- Admin Web App is permanently first-class (`DEVELOPMENT_RULES.md` §15) — every new Donor/
  Institution feature needs an Admin-side counterpart. (Not relevant to pure QA/bugfix work
  under the current feature freeze.)
- **XCTest/XCUITest migration — evaluated, NOT implemented.** Stakeholder asked for a feasibility
  assessment (this session) to replace screenshot-heavy manual QA with accessibility-identifier-
  driven XCUITest. Key finding: requires switching from Expo Go to a custom dev client
  (`expo prebuild` / `eas build --profile development`), since Expo Go's fixed binary can't host
  a custom XCTest target. Recommended as a post-V1 QA-infra investment, not a V1-blocking change
  (see full write-up in chat history this session for the phased rollout plan). No code/config
  changed as a result of this evaluation.
- **All three Next.js web apps converted to static export (`output: 'export'`), RC1 Phase 2.**
  Donor Web, Institution Web, and Admin Panel are fully client-rendered SPAs (every `page.tsx` is
  `'use client'`; no Server Components with data fetching, Route Handlers, middleware, `next/image`,
  or dynamic routes) — confirmed by direct inspection and by empirically building all three under
  `output: 'export'` before making it permanent. Deploy as free Render Static Sites instead of paid
  Web Services, no functionality lost. Also fixed `out/` missing from both `.gitignore` and
  `eslint.config.js`'s ignore list (was causing ESLint to lint minified static output directly).

---

## QA Progress

| Module | Certified | PASS/FAIL | Commit |
|---|---|---|---|
| RC1 — In-app account deletion (Donor self-service) + Settings deletion-link wiring (all 4 apps) | 2026-08-02 | **PASS.** Verified against real production Firebase/Sheets via the actual Donor Web UI: wrong-email confirmation correctly kept "Confirmar eliminação" disabled; correct email enabled it; `DELETE /donor/account` → 204; confirmed via `getUserByEmail` that the Firebase Auth user no longer exists; confirmed via direct Sheets read that `Name`/`Phone`/`Corporate_Account_ID` are blank, `Show_Name_To_Institutions` is `FALSE`, `Status` is `Deleted`. A real gap (Email not cleared) was caught before commit — see Bugs Fixed — and re-verified in isolation: `findUserByEmail` now correctly returns `null` for the old address post-deletion, confirmed on a second disposable row. Institution Web's new "Solicitar eliminação de conta" link confirmed rendering with the correct `https://wafina-donor-web.onrender.com/delete-account` URL via a live authenticated session. `npm run typecheck`/`npm run lint` clean across all 8 workspaces. All disposable test rows cleared afterward (2 Users rows, 1 real Firebase Auth user deleted as part of the test itself). Mobile (Donor + Institution) changes are typecheck/lint-verified only — not run in a simulator this cycle. | pending push |
| RC1 — Individual vs. Corporate donation regression + smoke test (post-deploy, live production) | 2026-08-02 | **PASS — 23/23 checks**, zero regressions found. Backend + Donor Web frontend both confirmed already auto-deployed on Render before testing began. Covered: registration, login, password-reset trigger, profile completion, invitation-code redemption, Individual donation creation (`Corporate_Account_ID: null`), Corporate donation creation (matches company ID), `/donations/mine` returns both with correct attribution data, notifications endpoint, `/donor/corporate-account`, Institution sees + claims + runs the **full lifecycle** (claim→schedule→collect→deliver) on **both** donation types, Admin `Donation_Count` correctly counts only the Corporate one (1, not 2), Impact Stories creation+approval+donor-visibility. One apparent failure on first pass (donor didn't immediately see a new Success Story) was **not a regression** — confirmed it's pre-existing, untouched `Pending`-by-default moderation behavior (`services/success-stories.ts`); re-tested after approving the story and it passed. All disposable test data (1 Firebase user, 1 company, 1 invitation code, 2 donations, 1 success story) fully cleaned up afterward. | `2c1dce5` / `e605e9c` (already deployed, no new commit needed for the test itself) |
| Web — Donor Web full end-to-end (real login → authenticated Home with real profile data) | 2026-08-02 (RC1) | PASS — full chain verified after ALLOWED_ORIGINS update: Firebase Auth + API + Sheets data all confirmed live | `945423b` + ALLOWED_ORIGINS update |
| Web — Institution Web full end-to-end (real login → authenticated dashboard with real stats) | 2026-08-02 (RC1) | PASS (after fixing a deploy misconfig — see Bugs Fixed) — full chain verified, dashboard stats match known test account history | af3b92d / deploy config fix |
| Web — Admin Panel live on Render Static Site (`wafina-admin-panel`) | 2026-08-02 (RC1) | PASS for build/CORS/Firebase-reachability (dummy-credential check); full authenticated login NOT performed — no real admin credentials used this session | af3b92d |
| Android — Donor app full lifecycle | 2026-07-31 | PASS (after fix) | `e4b8707` |
| Android — Institution app full lifecycle | 2026-07-31 | PASS | `e4b8707` |
| iOS — Donor: sign up, session bootstrap | This session | PASS | not yet committed |
| iOS — Donor: donation + photo upload | This session | PASS | not yet committed |
| iOS — Donor: suspended-account / sessionError flow | This session | PASS | not yet committed |
| iOS — Donor: Sair (sign out) button | This session | UNCONFIRMED (see Remaining Bugs) | — |
| iOS — Institution: sign up + registration | This session | PASS | not yet committed |
| iOS — Institution: claim → schedule-collection → collect → deliver | This session | PASS (all 4 API calls returned 200, verified via server log) | not yet committed |
| iOS — Institution: post-delivery "Criar História" alert → success story creation (title/description/photo) | This session | PASS (POST /success-stories → 201, verified stored Title/Description/Image/Status=Pending via Sheets read) | not yet committed |
| iOS — Institution: logo upload — locked-field change-request path | This session | PASS (POST /change-requests -> 201, verified Field_Requested="Logo", Reason text, Status=Pending via Sheets read) | not yet committed |
| iOS — Institution: logo upload — direct picker-upload path (PATCH /institutions/me/logo) | Blocked this session (see Remaining Bugs — new-institution sign-up never completed; "Criar conta" produced no server signal across 5 attempts) | — | — |
| iOS — Notifications (mobile) | Not started | — | — |
| iOS — Offline/poor-network behavior | Not started | — | — |
| Android — EAS Cloud Build, production profile (`wafina-donor`, real cloud build, not `--local`) | 2026-08-03 | **PASS for compile/package only — SUPERSEDED, see correction below.** Build ID `502cdd66-5647-4c8f-8574-cab893ba0c44`, `BUILD SUCCESSFUL in 12m 52s`, produced `app-release.aab` (52.1 MB), status `FINISHED`. Verified via the full structured build log: `eas-build-post-install` hook rebuilt `packages/shared`; zero `@wafina/shared` resolution errors; `EAGER_BUNDLE` succeeded; Gradle completed clean; AAB download link reachable. **This PASS covered build/package correctness only — it did not and could not catch the runtime env-var bug below, since neither cloud-build success nor CI exercises `EXPO_PUBLIC_*` resolution.** Only non-blocking finding at the time: `expo doctor` flagged 4 packages with available patch updates — pre-existing drift, unrelated. | `6dca017` |
| Android — Production runtime config correction + re-verified cloud build | 2026-08-03 | **PASS.** Found (see Bugs Fixed): build `502cdd66`'s AAB was non-functional on a real device — Firebase Auth config baked in as `undefined`, API base URL baked in as `localhost:4000`. Fixed via `apps/mobile-donor/eas.json`'s new `production.env` block (`cde858c`). Re-verified with a brand-new cloud build, Build ID `b6c977c7-4bf4-4c01-8934-b96da0e5ebc4` (https://expo.dev/accounts/zuinder/projects/wafina-donor/builds/b6c977c7-4bf4-4c01-8934-b96da0e5ebc4), `BUILD SUCCESSFUL in 6m 19s`, `app-release.aab` (52.1 MB), status `FINISHED`, commit `cde858c`. EAS's own CLI output confirmed the fix loaded: *"Environment variables loaded from the 'production' build profile 'env' configuration: EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_APP_ID."* Independently confirmed by downloading the new AAB and byte-searching the extracted Hermes bundle: the real Firebase API key, project ID, App ID, and the real API URL (`wafina-api-rd0q.onrender.com`) each appear exactly once; `localhost:4000` appears zero times. Full structured build log re-checked the same way as the first build: `@wafina/shared` still resolves cleanly (no regression), `EAGER_BUNDLE` succeeded, only non-blocking finding is the same pre-existing `expo doctor` patch-version drift. GitHub CI green on the fix commit (run `30797475526`). **Not verified: actual on-device authentication, backend connectivity, or runtime flows** — this Mac has no Android SDK/emulator/adb/Java and no Google Play Console access, so nothing beyond the compiled artifact could be exercised. A real device or Play Console Internal Testing pass is still required before this can be called launch-ready. | `cde858c` |

---

## Current Branch

- Branch: `main`
- Latest commit: `bc486a1` — "Record Android verification round commit hash in PROJECT_STATUS.md"
- Working tree: clean as of start of this iOS session (no uncommitted app-code changes yet —
  all iOS work so far has been live-testing against already-committed code, not new edits).

---

## Next Module To Audit

**iOS — Institution app: retry direct logo-upload picker path (new institution sign-up), then
Notifications, then offline/poor-network behavior.**

Logo-upload change-request path (locked-field flow) is PASS. The direct picker-upload path
(`PATCH /institutions/me/logo`) is still untested — this session's attempt to create a second,
unverified test institution was blocked by the Institution `SignUpScreen` "Criar conta" button
producing no server signal after 5 attempts (see Remaining Bugs — needs a live human/device
retest before assuming it's a real app bug, since it may be simulator-automation-specific like
the Donor "Sair" issue). **IMPORTANT — current app state:** the simulator is currently signed
OUT (mid a failed sign-up attempt on a garbled `SignUpScreen`). To resume other Institution
modules (Notifications, offline), first sign back in with the original verified test account:
`wafi.inst.test@gmail.com` / `TestPass123`. Donor iOS "Sair" button also remains Unconfirmed (see
Remaining Bugs) — still needs a live human/device re-test.

---

## iOS Simulator Calibration (reuse — do not recalibrate unless UI changes)

**Device:** iPhone 17 Pro Max, device space 440×956pt, screenshot scale ≈2.09x.

**Institution app bottom tab bar** (6 tabs, evenly spaced, y≈900pt device points; x = column center):

| Tab | Label | Device coords (x, y) |
|---|---|---|
| 1 | Início (Home) | (37, 900) |
| 2 | Disponíveis (Available Donations) | (110, 900) |
| 3 | Aceites (Claimed By Me) | (183, 900) |
| 4 | Ocorrências (Disputes) | (257, 900) |
| 5 | Notificações | (330, 900) |
| 6 | Definições (Settings) | (403, 900) |

Note: the Expo dev-menu overlay ("Wafina Instituição / SDK version.../ Continue" card) can pop up
unexpectedly (observed twice this session, cause unclear — possibly a stray shake/two-finger
gesture from automation) and blocks the tab bar entirely. If a tap silently fails to navigate,
check for this overlay first (Continue button ≈ device (220, 568); X close ≈ device (400, 451))
before assuming a real app bug.

**Institution "Aceites" (Claimed By Me) card — single-item layout, action button position:**
For a card with 1 status line + short 4-stage timeline (Aceite/Recolha Agendada/Recolhida/
Entregue) and no Expected_Collection/Delivery_Date line yet: primary status-action button
("Confirmar recolha agendada" / "Marcar como recolhida" / "Confirmar entrega", same slot,
same position since only one shows at a time per status) ≈ device (167, 540). "Comunicar
Ocorrência" ghost button just below it ≈ device (151, 590). These will shift down if
Expected_Collection_Date/Expected_Delivery_Date lines are present (extra ~20-24pt each) —
recheck with a screenshot if a tap at these coordinates doesn't produce the expected API log
line.

**Institution "NewSuccessStory" form (`NewSuccessStoryScreen.tsx`) — device coords:**
Título input (220, 224) · Descrição input (220, 322) · "Escolha uma fotografia" well (220, 411).
**After a photo is attached, the layout shifts** (well replaced with a 200pt-tall preview image +
a new "Escolher outra fotografia" secondary button): "Escolher outra fotografia" ≈ (220, 654) ·
**Publicar (post-photo) ≈ (220, 710)** — do not reuse the pre-photo y=481 estimate, it now lands
on "Escolher outra fotografia" instead and silently reopens the photo picker (no error, no log —
only visible via screenshot or a missing `POST /success-stories`).

**Native photo-library picker quirk:** the first tap on a grid thumbnail sometimes doesn't
register/close the picker (same class of flakiness as the documented paste-menu issue) — the
grid stayed open silently through one full tap+wait cycle. Retry the same thumbnail tap once;
it succeeded on retry both times this session.

**Institution "SettingsScreen.tsx" — Logo section + change-request form, device coords:**
Definições tab lands here directly. Logo section sits at the very top of the first Card. IMPORTANT:
once an institution is Admin-verified, ALL profile fields (`Name, Type, Location, Needs_List,
Logo` — `ALL_PROFILE_FIELDS` in `apps/api/src/services/institutions.ts`) auto-lock, per spec
4.2.4 — the direct "Adicionar/Alterar logótipo" picker button is replaced by a locked-field
message, and the only reachable path is "Solicitar alteração" (change request). This is correct,
designed behavior, not a bug — do not re-flag it.

Change-request form (second Card): native `@react-native-picker/picker` wheel for "Campo"
(options in fixed order Selecione/Nome/Tipo/Localização/Itens Necessários/**Logótipo** — Logo is
always last). To select Logótipo from the default "Selecione..." position: `touch_path` drag from
device (220, 650) to (220, 490) — a 160pt upward drag (5 rows × 32pt native row height) — lands
exactly on Logótipo (confirmed via Sheets read, no retry needed). Motivo textarea ≈ (220, 735).
Dismiss keyboard by tapping the screen title ≈ (220, 78) before tapping Enviar pedido (this screen
uses `KeyboardAvoidingView`, so the button shifts while the keyboard is open). Enviar pedido ≈
(220, 814) — confirmed correct with keyboard dismissed first.

**Not yet tested:** the direct `PATCH /institutions/me/logo` picker-upload code path
(`onPickLogo` in `SettingsScreen.tsx`) only runs when Logo is NOT in `Locked_Fields` — i.e. only
reachable with a freshly-registered, not-yet-Admin-verified institution. The current disposable
test institution is already verified, so this path could not be exercised without creating a
second, separate test account. Uses the same `uploadFile()` helper already proven working on iOS
for donation photos and Success Story photos this session, so an iOS-specific bug here is
unlikely but not directly confirmed.

**Known simulator quirk:** emoji (📍 location pin, 📅 calendar) render as boxed "?" placeholder
glyphs in the iOS Simulator on this machine — a Simulator font-fallback limitation, not an app
bug. Real devices render these emoji normally.

**Severe text-input unreliability on Institution `SignUpScreen` email field (this session):** a
plain, full-string `text` action on an EMPTY field dropped 18 of 25 characters on the first
attempt. Chunked re-typing (4-char bursts) to append the missing suffix made it worse — later
diagnosis showed characters landing out of order / mid-string rather than cleanly appended,
suggesting the tap used to "resume" a partially-filled field does not reliably place the cursor
at the end every time. `\b` (backspace) is NOT interpreted as a delete keystroke by this tool —
it types the literal two characters `\` and `b`. There is no working clear/select-all mechanism
via this tool for a populated text field. **The only confirmed reliable way to reset a text field
is to navigate away from the screen and back** (unmounting/remounting resets local React state
to `''`) — this worked cleanly for `SignUpScreen`. Even after that clean reset, submitting a
short, correctly-typed email+password produced no server signal at all (see Remaining Bugs) —
this second issue is unrelated to the typing quirk and remains unresolved.

**Institution "Sair" (sign-out) button worked correctly on the first tap this session** — unlike
the Donor app's unconfirmed "Sair" issue, this is not evidence of a systemic sign-out-button bug
across the platform.

---

## Files Frequently Used

- `apps/mobile-institution/src/context/AuthContext.tsx` — sessionError/signIn logic.
- `apps/mobile-institution/src/lib/api.ts` — `uploadFile()` (logo, success story photo).
- `apps/mobile-institution/src/screens/SettingsScreen.tsx` — logo upload UI.
- `apps/mobile-institution/src/screens/NewSuccessStoryScreen.tsx` — success story + photo upload.
- `apps/api/src/services/institutions.ts` — `verifyInstitution()` and related backend logic.
- `apps/api/src/services/donations.ts` — claim/schedule/collect/deliver state transitions.
- `apps/api/src/config/sheet-tabs.ts` — `SHEET_TABS` constant (correct import path; NOT exported
  from `sheets.ts` itself).

---

## Important Commands

**Boot/attach the iOS Simulator (only one device should be booted to avoid ambiguity):**
```
xcrun simctl list devices | grep -i booted
xcrun simctl shutdown <extra-device-udid>
xcrun simctl boot <target-udid>
```
Target device this session: iPhone 17 Pro Max, `BCD006C4-ADC9-41F0-9350-0081AC2B92C3`.

**Start Expo dev server pointed at the simulator (kill any other app's server on 8081 first):**
```
cd apps/mobile-institution && nohup npx expo start --ios > /tmp/expo-institution-ios.log 2>&1 &
```

**Force Expo Go to reload a specific project without re-picking from the launcher:**
```
xcrun simctl terminate <udid> host.exp.Exponent
xcrun simctl openurl <udid> "exp://192.168.1.138:8081"
```

**Run API server locally with captured logs:**
```
cd apps/api && nohup npx tsx watch src/index.ts > /tmp/api-ios-test.log 2>&1 &
curl -s http://localhost:4000/health
```

**One-off Sheets scripts (write to `apps/api/scripts/tmp-*.ts`, run via `npx tsx`, delete
immediately after):**
```ts
import { getRows, updateRow } from '../src/config/sheets';
import { SHEET_TABS } from '../src/config/sheet-tabs'; // NOT from sheets.ts
```
`updateRow(tab, keyColumn, keyValue, patch)` — 4 args, not a predicate function.

---

## Session Notes

**Disposable test accounts created this session (NOT yet cleaned up):**
- Donor: `wafi.donor.test@gmail.com` / `TestPass123`, User_ID
  `06426704-1738-486c-b789-43e98526bf5d`, Status currently `Active` (was briefly `Suspended` to
  test the sessionError fix, then reactivated).
- Institution: `wafi.inst.test@gmail.com` / `TestPass123`, Institution_ID
  `2b89b41e-7d35-46eb-8b37-714d77414c25`, Name "IOS Test Inst", Verification_Status now
  `Verified` (manually approved via a one-off script call to `verifyInstitution()` since Admin
  approval normally takes days).
- One donation created and left in place: Donation_ID `790d0cc9-20dd-4240-aeb4-286f09b99b8e`,
  Public_Donation_Code `AO-000031`, Status `Pending`, real Google Drive photo URL attached.
- 2026-08-02 bug-report investigation: created Donation_ID `def9ccd9-5e7b-4684-8094-6352587bea0b`
  (`AO-000033`, "Alimentos frescos") on the existing `wafi.donor.test@gmail.com` account and ran it
  through the full lifecycle live — now sits in `Status: Delivered`, left in place as a real,
  harmless completed record. Also created one throwaway Firebase user
  (`wafi.bugrepro.<timestamp>@gmail.com`) to test the incomplete-profile edge case — its Users row
  has `profileComplete: false` and was never used to create any donation (the API correctly
  rejected the attempt); safe to ignore or delete, never claimed/completed anything.
- 2026-08-02 Individual-vs-Corporate donation feature: created Donation_ID
  `2de9c03f-8607-4bda-a4ef-e98e50dced29` (`AO-000034`, "Roupas") on the existing
  `wafi.donor.test@gmail.com` account while testing the "Doar como: Pessoal" path against a local
  API instance — left in place as a harmless `Status: Pending` record, same pattern as AO-000031/
  AO-000033. All *other* fixtures for this test (a disposable donor account, a disposable "Endiama QA
  Test" company, its invitation code, and a second disposable donation testing the Corporate path)
  were fully deleted/cleared afterward — nothing else left behind.

**Cleanup still owed before final commit:** delete/reset the above test rows from `Users`,
`Institutions`, and `Donations` sheets, and delete the Firebase Auth accounts, matching the
discipline used at the end of the Android verification round.

**Per user instruction (this session):** adopt the strict QA operating procedure below for all
future work on this project until V1 is certified — one module per session, memory-file-driven
(read this file first, not chat history), minimize screenshots/full-repo scans/log dumps, ask
before high-cost actions, stop and report after each module instead of chaining work.
