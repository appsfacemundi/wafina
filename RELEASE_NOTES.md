# Wafina — Release Notes

## Version

**v1.0.0-RC1** (Release Candidate 1). Package versions across all workspaces remain at the internal
`0.0.1` dev baseline — no tag has been cut yet. Per `WAFINA_PILOT_LAUNCH_CHECKLIST.md`, `v1.0.0-beta`
gets tagged only once this checklist's remaining open items are closed.

## Build Date

2026-08-02

**Android production AAB: generated, and a critical runtime config bug found and fixed (2026-08-03).**
`apps/mobile-donor` now has a working `eas.json` and EAS project (`wafina-donor`), with a real signed
keystore (remote, Expo-managed). The first successful cloud build (`502cdd66`) compiled and packaged
correctly but shipped completely non-functional on a real device: `EXPO_PUBLIC_*` env vars were never
supplied to the build, so Firebase Auth config baked in as `undefined` and the API base URL baked in as
`localhost:4000` — cloud-build success and green CI do not exercise this at all, so it was invisible
until specifically investigated. Fixed by adding a `production.env` block to `eas.json`
(commit `cde858c`) and re-verified with a new build — Build ID `b6c977c7-4bf4-4c01-8934-b96da0e5ebc4`
(https://expo.dev/accounts/zuinder/projects/wafina-donor/builds/b6c977c7-4bf4-4c01-8934-b96da0e5ebc4),
producing `app-release.aab` (52.1 MB). Confirmed by downloading the actual shipped bundle and verifying
the real Firebase key/project ID and real API URL are baked in, and `localhost:4000` is gone. See
`PROJECT_QA_MEMORY.md` QA Progress table for full verification detail. **Still not verified: actual
on-device authentication, backend connectivity, or runtime flows** — no Android SDK/emulator/device or
Google Play Console access was available to exercise this; a real device or Internal Testing pass is
required before this build can be called launch-ready. `apps/mobile-institution` still has no `eas.json`
and has not been built yet (and its `.env` has the same `localhost` pattern — apply the same fix before
its first build). An iOS TestFlight build and production-pointed Web/Admin builds remain blocked on one
open stakeholder decision, already flagged in `WAFINA_PILOT_LAUNCH_CHECKLIST.md`:

1. **API hosting** — `apps/api` currently runs only as a local dev process; no host, domain, or SSL is
   configured. All three web apps' `.env.local` still point `NEXT_PUBLIC_API_BASE_URL` at
   `http://localhost:4000`. A build made today would not be reachable by a real remote pilot user.

An Apple Developer Program membership is also still needed before an iOS TestFlight build can be
produced.

## Fixed Issues (cumulative, this stabilization cycle)

- Android: broken photo uploads and a silent auth-failure bug fixed and live-verified.
- All three web apps: silent auth-failure bounce fixed — a Firebase-signed-in-but-backend-rejected
  session (suspended account, no matching row) used to land the user back on the logged-out screen with
  no explanation; now the sign-in form's own error banner catches it before navigating away.
- Google Drive: corrected the photo/logo thumbnail URL format (`thumbnail?id=` instead of `uc?id=`),
  fixing every photo rendering as a broken image cross-origin.
- API: rate limiting (3-tier, `express-rate-limit`), structured JSON request/error logging, and a working
  Sheets-to-JSON backup script (`apps/api/scripts/backup-sheets.ts`) all added and live-verified.
- Admin Reports: CSV/formula-injection gap fixed.
- Admin: donation-visibility gap fixed.
- Admin Web App brought to full feature parity — Users (search/suspend/reactivate/role-change/password
  reset), Countries (activate/create), Disputes (resolve), Corporate Accounts (full CRUD + a real
  Invitation Codes system with expiration/max-usage), Notifications (manual send + scoped broadcast +
  history), Reports (6 types + CSV export).
- Full i18n sweep across backend-originated user-facing strings.
- iOS: Donor and Institution full donation lifecycles (claim → schedule → collect → deliver), Success
  Story creation with photo, and the institution logo-upload change-request path all live-verified this
  cycle via server logs and Sheets read-back.
- Android: Donor and Institution full lifecycles live-verified.
- RC1 cleanup: removed 8 leftover one-off `tmp-*.ts` debug/verification scripts from
  `apps/api/scripts/` (unreferenced anywhere, safe to delete).
- RC1: `apps/api` deployed to production on Render (`https://wafina-api-rd0q.onrender.com`,
  Frankfurt). Fixed two real build blockers found during the deploy: a TypeScript version drift
  across workspaces causing a `moduleResolution` deprecation error, and `NODE_ENV=production`
  causing npm to skip devDependencies needed at build time.
- RC1: fixed `apps/admin`'s production build, which had never been run before (`next build`
  failed on `useSearchParams()` needing a Suspense boundary on the sign-in page) — a real,
  previously-undetected bug caught by this being Admin's first production build attempt.
- RC1: converted Donor Web, Institution Web, and Admin Panel to static export (`output: 'export'`)
  after confirming all three are fully client-rendered SPAs with no Server Components, Route
  Handlers, middleware, or dynamic routes — verified empirically via real production builds before
  making it permanent. Lets all three deploy as free Render Static Sites (CDN-distributed, no
  cold-start risk) instead of paid always-on Web Services, with zero functionality loss. Also fixed
  `out/` being missing from `.gitignore` and from ESLint's ignore list.
- RC1: Donor Web deployed live at `https://wafina-donor-web.onrender.com` (Render Static Site).
  Verified with a real disposable test account that Firebase Auth succeeds end-to-end against
  production; the subsequent call to our own API fails only because `ALLOWED_ORIGINS` hasn't been
  updated yet (planned, not yet done — tracked in `RC1_RELEASE_ROADMAP.md`).
- RC1: Institution Web and Admin Panel deployed live (`wafina-institution-web`,
  `wafina-admin-panel`, both Render Static Sites). Found and fixed a real deployment
  misconfiguration where Institution Web's service was initially set up with Admin's Build Command
  and Publish Directory, causing it to serve the wrong app under the wrong URL — caught by checking
  the page title/content rather than assuming a successful-looking deploy log meant the site was
  correct. Both now verified working (Institution via a real disposable test account through
  Firebase Auth; Admin via a dummy-credential check confirming Firebase Auth is reached).
- RC1: Phase 2 (Web Applications) complete. Updated `ALLOWED_ORIGINS` on the live API to include
  all three production URLs, then verified full end-to-end functionality with real logins: Donor
  Web and Institution Web both successfully authenticate and load real account data through the
  live API. Admin Panel's build/CORS/Firebase-reachability is confirmed but a full authenticated
  login wasn't performed (no real admin credentials used in this workflow) — flagged for the
  stakeholder to confirm at their convenience, though it shares the identical code path already
  proven working for the other two apps.
- RC1: fixed GitHub Actions CI, which had been failing on every single push since the repo's very
  first commit (pre-existing, not caused by RC1 work — caught via a GitHub notification email, not
  by actively watching CI). Root cause: `npm run build` in CI never had the Next.js apps'
  `NEXT_PUBLIC_FIREBASE_*` / `NEXT_PUBLIC_API_BASE_URL` values configured, so Firebase's client SDK
  threw `auth/invalid-api-key` during static-page prerendering. Fixed by adding these (non-sensitive
  client config, meant to ship in the bundle) directly to `.github/workflows/ci.yml`. Verified by
  simulating CI's exact environment locally (temporarily removing all three apps' `.env.local`
  files, building with only shell-exported env vars) before pushing.
- RC1 Phase 3: published a bilingual (Portuguese/English) Privacy Policy as a new `/privacy` static
  route on the already-live Donor Web app — no new hosting needed. Content was drafted from the
  actual codebase, not a template: verified exactly which fields `Users` collects (Name, Phone,
  Home_Country_ID), confirmed no push-notification token system exists (no `expo-notifications`
  integration found — notifications are in-app only), and named Google Sheets/Drive/Firebase as the
  data processors involved. Required before either store's Data Safety / App Privacy questionnaires
  can be completed.
- RC1 Phase 3: broadened platform scope, at the stakeholder's explicit direction, to cover perishable
  goods (fresh food, prepared meals) alongside non-perishable goods, not non-perishable-only. This
  surfaced a real gap while drafting the Terms & Conditions: the app had no food category at all in
  `packages/shared/src/enums/item-type.ts`. Added three new entries (`Alimentos frescos`, `Refeições
  preparadas`, `Mercearia/Alimentos não perecíveis`) — a single shared-package change that propagated
  to every consuming screen automatically, since `Item_Type` is a plain string everywhere it's
  displayed. Published a new bilingual Terms & Conditions page at `/terms` with a food-safety
  disclaimer (donor responsible for a perishable item being safe and unexpired at transfer;
  institution responsible for inspecting at collection). Updated `MASTER_SPECIFICATION.md` and the
  Privacy Policy's scope language to match. Live-verified the new categories appear correctly in the
  real donation-creation form via an authenticated session.
- RC1 Phase 3: finalized mobile application IDs. The stakeholder asked to confirm the package names
  against an assumed `com.zuinder.*` scheme; the codebase actually had `org.wafina.donor` /
  `org.wafina.institution`. Since neither app had any native project folders, EAS registration, or
  store presence yet, renamed both to `com.zuinder.wafina.doador` and
  `com.zuinder.wafina.instituicao` in `app.json` at zero migration cost — this was confirmed before
  changing, since these IDs become permanent the moment either store app is created.
- RC1 Phase 3: added a bilingual `/delete-account` page on Donor Web to satisfy Google Play's Data
  Safety requirement for a web link users can use to request account/data deletion. Checking the
  codebase first found no in-app self-service deletion exists at all today — this page is a
  support-mediated stopgap (email request, processed within 30 days), not a replacement for real
  in-app deletion, which remains an open, undecided item.
- Investigated and definitively root-caused a stakeholder-reported "critical blocking bug" (a
  donor's donation not appearing in the Institution app's Available Donations) — not by assumption,
  by directly querying the live production `Donations`/`Institutions`/`Geo_Regions` data. Confirmed:
  the donation pipeline itself works correctly (verified live, create → claim → schedule → collect →
  deliver); the query has no hidden approval flag, GPS filter, date filter, or caching (all
  confirmed absent by reading the actual filter function and by direct evidence); and the real
  instance found in production was the stakeholder's own account having switched its Active Country
  to Portugal, a country with **zero verified institutions** registered — every real institution in
  the system is under Angola. The two resulting donations are correctly invisible because no
  institution exists yet in that country, not due to a defect. Fixed a related real gap: the
  Available Donations empty state now names the institution's own country instead of a generic
  message, so this kind of country-coverage gap is no longer indistinguishable from a broken
  pipeline. Recommended (not yet built, would need Feature Freeze sign-off): warn a donor at
  donation-creation time if their Active Country has no verified institutions yet.
- Corporate Invitation Codes: a stakeholder request to "build" this feature turned out to already be
  ~95% live in production (create company, generate/deactivate codes, donor-side redeem via "Associar
  conta", automatic donation-to-company association derived from `Donor_ID → Users.Corporate_Account_ID`
  at read time). Verified each piece against the actual code rather than rebuilding from scratch. The
  one genuine gap — no copy-to-clipboard button on a generated code — is now fixed in
  `apps/admin/src/app/companies/page.tsx`. Live-tested end-to-end with a disposable throwaway Admin
  account: created a test company, generated a code, clicked "Copiar," confirmed the toast and that
  the write succeeded, then fully cleaned up (deleted the Firebase test user and cleared all test
  rows).
- RC1: Individual vs. Corporate donation attribution. Previously, once a donor linked to a company,
  *every* donation they made was automatically counted as corporate — the stakeholder correctly
  flagged this as wrong business logic (an employee's personal donation from home shouldn't credit
  their employer). Recommended and got sign-off on a simpler schema than proposed: a nullable
  `Corporate_Account_ID` directly on the `Donation` row (blank = personal, filled = that specific
  company gets credit) instead of a separate type field plus the old donor-ID join — this actually
  *removes* a join step from `listDonationsByCorporateAccount` rather than adding one. The donor
  now sees a simple "Doar como" choice (Doação Pessoal / Doação da Empresa) on the donation form,
  shown only when they're linked to a company; the donor-company link itself never changes based on
  this per-donation choice. "Minhas Doações" was already going to be affected by this — clarified with
  the stakeholder that it must always show the donor's *own* donations (never teammates'), so it was
  simplified to drop the old "company-wide view" branch entirely, with each donation now labeled
  👤 Doação Pessoal or 🏢 Doação da Empresa – Company Name. Admin's company `Donation_Count` updated
  to match (counts only explicitly-corporate donations). New minimal `GET /donor/corporate-account`
  endpoint added so the UI can show the actual company name. One-time schema migration added a
  `Corporate_Account_ID` column to the live `Donations` sheet (existing rows unaffected — read as
  blank/personal, exactly correct for donations made before this feature existed). Verified end-to-end
  against a local API instance pointed at the real data: a disposable donor joined a disposable test
  company, submitted one Individual and one Corporate donation, confirmed `Corporate_Account_ID` was
  null vs. the company ID respectively, confirmed `/donations/mine` returned both, and confirmed the
  company's `Donation_Count` was 1 (not 2) — then fully cleaned up all test data (Firebase user,
  company, code, both donations).
- RC1: post-deployment targeted regression + smoke test for the Individual vs. Corporate donation
  feature. Confirmed both the API (Render Web Service) and Donor Web (Render Static Site) had already
  auto-deployed the change before testing began. 23/23 checks passed against live production: full
  registration→login→password-reset→profile-completion flow, invitation-code redemption, both
  donation types created with correct `Corporate_Account_ID` attribution, "Minhas Doações" returning
  both with correct data for the 👤/🏢 labels, notifications, Institution seeing/claiming/running the
  complete claim→schedule→collect→deliver lifecycle on **both** donation types, Admin's company
  `Donation_Count` correctly counting only the Corporate one, and Impact Stories creation + Admin
  approval + donor visibility. Zero regressions found — the one thing that looked like a failure on
  first pass (a brand-new Success Story not immediately visible to the donor) turned out to be
  correct, pre-existing moderation behavior (stories start `Pending` until Admin approves), not
  caused by this feature. All disposable test data fully cleaned up afterward.

- RC1: in-app account deletion, scope decided and implemented. Google Play's account-deletion policy
  expects the deletion option to be discoverable *from within the app*, not just reachable via a URL —
  checked and found the existing `/delete-account` page wasn't linked from any app's Settings screen at
  all; fixed by linking it from Donor Web/mobile and Institution Web/mobile. Separately, true
  self-service deletion (an actual "Delete My Account" action, not a support request) didn't exist
  anywhere — built for **Donor accounts only**, a stakeholder-approved scope decision: Institution
  accounts stay support-mediated, since an institution's name/logo/verification is displayed
  platform-wide and institutions are a smaller, relationship-managed user base where the added
  cascading complexity wasn't judged worth it for V1. New `DELETE /donor/account` deletes the Firebase
  Auth user and anonymizes the `Users` row (Name/Phone/Email cleared, `Corporate_Account_ID` cleared,
  `Show_Name_To_Institutions` forced off, new `Status: 'Deleted'`) — Donations and Success Stories need
  no code changes at all, since they already reference the donor only by ID and already render a
  missing/anonymized donor as anonymous. `requireAuth`'s suspension check was broadened from
  `=== 'Suspended'` to `!== 'Active'` so a deleted account is locked out immediately, not just once its
  Firebase token happens to expire. A real bug was caught and fixed before this ever shipped: the first
  pass left `Email` on the anonymized row, which would have permanently blocked that address from ever
  registering again (`findUserByEmail`, used on every login, matches on it) — fixed by clearing `Email`
  too and re-verifying the exact re-registration path this time, not just the delete call in isolation.
  Verified end-to-end against live production data through the real Donor Web UI: a disposable donor's
  full deletion flow was run through the confirmation UI (wrong email correctly blocked the button;
  correct email enabled it), confirmed the Firebase user was truly gone, and confirmed every field on
  the Sheets row was correctly cleared. Institution Web's new deletion link was confirmed rendering with
  the correct URL via a live session. Mobile (Donor + Institution) changes are typecheck/lint-clean but
  weren't run in a simulator this cycle.

## Known Limitations (deliberate scope decisions, tracked in `VERSION_2_ROADMAP.md`)

- No automated test suite anywhere in the codebase — all verification to date has been manual, live QA.
- Google Sheets' per-minute rate limit is mitigated (retry-with-backoff) but not eliminated under
  sustained (not just bursty) load.
- Admin cannot edit or cancel a donor's raw donation (no support-override path).
- Admin cannot suspend a verified institution after the fact (only reject before verification).
- No per-country statistics rollup for Admin.
- No pagination on any list endpoint; a few N+1-shaped Admin lookups — fine at pilot scale.
- Corporate Account logo upload not built (cosmetic gap only).
- Settings / feature flags: deferred — nothing in the codebase reads a flag or setting today.
- Reports: no date-range/status filtering or charts yet.
- One pre-existing orphaned `Corporate_Account_ID` data pointer on a real Donor row — handled gracefully
  (`getCorporateAccountById` returns `null`), not urgent.
- No recurring/scheduled backup — the export script works and was run successfully against production,
  but scheduling depends on the still-open hosting decision.
- No dedicated error-tracking or uptime-monitoring service — structured logging exists and is ready for
  any log aggregator, but nothing is currently wired to alert on failures.
- Backup **restore** path is untested — the export direction works, restoring into a fresh sheet has
  never been tried.
- No systematic schema-validation layer at the API boundary (validation is thorough but ad hoc,
  per-service `ValidationError` checks rather than e.g. `zod`).

## Remaining Observations (unconfirmed — need a live human/device retest, not simulator automation)

- **Donor Home "Sair" (sign out) button**: unresponsive across 7+ iOS Simulator tap attempts (varied
  coordinates and gesture types). The underlying `signOut(firebaseAuth)` call itself is proven working
  via a different path (the suspended-account forced-signout test hits the exact same code). Every other
  button on the same screen responded normally. Suspected simulator-automation tap-registration artifact,
  not a confirmed app bug.
- **Institution SignUpScreen "Criar conta"**: produced zero server signal (no `POST /auth/session`) across
  5 consecutive iOS Simulator attempts, including after a confirmed clean component-state reset with a
  short, cleanly-typed email/password. Institution's own "Sair" button worked correctly the same session,
  so this is not the same class of issue as the Donor bug above — it appears specific to this screen's
  submit path, and its root cause (tap not registering vs. a silent client-side Firebase failure) is
  undiagnosed by design, per an explicit stop-and-preserve-the-finding instruction rather than continued
  blind screenshot-driven guessing.

Both items are flagged Low/Medium priority and Unconfirmed — neither blocks RC1 preparation, but both
should be retested on a real device or a fresh simulator session before being ruled in or out as real bugs.

## Configuration Verified This Round

- `apps/api/.env.example` matches every environment variable actually read by `config/env.ts` — no drift.
- Real `.env`/`.env.local` files are correctly gitignored; only `.env.example` is tracked.
- Firebase: a single consistent project (`wafina-98a3a`) is used identically across the API, all three
  web apps, and both mobile apps — no dev/prod project split exists in this architecture.
- Google Drive: production Shared Drive is configured; upload path uses the corrected thumbnail URL.
- Image uploads: all three upload routes (donations, success stories, institution logos) consistently
  cap at 8MB and filter to `image/*` via multer.
- Notifications: the generic Notification Engine (13+ event types, single write path, failure-tolerant)
  plus Admin manual-send/scoped-broadcast/history are complete and require no further changes under the
  current feature freeze.
