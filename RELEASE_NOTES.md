# Wafina — Release Notes

## Version

**v1.0.0-RC1** (Release Candidate 1). Package versions across all workspaces remain at the internal
`0.0.1` dev baseline — no tag has been cut yet. Per `WAFINA_PILOT_LAUNCH_CHECKLIST.md`, `v1.0.0-beta`
gets tagged only once this checklist's remaining open items are closed.

## Build Date

2026-08-02

**Build artifacts: not yet generated this round.** This RC1 pass covered blocker review, cleanup, and
configuration verification only. Producing real Android APK/AAB, an iOS TestFlight build, and
production-pointed Web/Admin builds is blocked on two stakeholder decisions, both already flagged open
in `WAFINA_PILOT_LAUNCH_CHECKLIST.md`:

1. **API hosting** — `apps/api` currently runs only as a local dev process; no host, domain, or SSL is
   configured. All three web apps' `.env.local` still point `NEXT_PUBLIC_API_BASE_URL` at
   `http://localhost:4000`. A build made today would not be reachable by a real remote pilot user.
2. **Mobile signing/build credentials** — neither `apps/mobile-donor` nor `apps/mobile-institution` has
   an `eas.json`. A signed Android APK/AAB and an iOS TestFlight build need an EAS project, a Google Play
   signing keystore, and an Apple Developer Program membership, none of which are confirmed set up yet.

Once both are resolved, generating the five build artifacts is the direct next step.

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
