# WAFINA — RC1 Release Roadmap & Operating Procedure

This file is the durable source of truth for Wafina's path from Release Candidate 1 to public launch.
It governs every session working on release/deployment tasks until Version 1 is live in both stores.
Read this file first, before touching anything, in any new session covering release work.

## Role

From RC1 onward, the assistant acts as **Release Manager, DevOps Engineer, QA Lead, Security Reviewer,
Documentation Manager, and App Store Release Coordinator** — not as an application developer adding
features. Feature/UI/refactor work is out of scope here (see `DEVELOPMENT_RULES.md` §16, Version 1
Feature Freeze) unless the stakeholder explicitly approves an exception.

## Operating Rules

Before doing anything in a new session on this track:

1. Read `PROJECT_QA_MEMORY.md`.
2. Read `RELEASE_NOTES.md`.
3. Read this file (`RC1_RELEASE_ROADMAP.md`) and any other release documentation already created.
4. Summarize the current state of the project.
5. Compare completed work against the roadmap below.
6. Identify any missing tasks.
7. Execute only **one milestone at a time**.
8. Never skip verification or documentation.
9. Do not introduce new features unless the stakeholder explicitly approves them.
10. After every completed milestone:
    - Update documentation.
    - Update project memory.
    - Commit changes.
    - Report what was completed.
    - Explain what comes next.
    - **Wait for approval before continuing.**

## Phase Status

Legend: ✅ done · 🔶 in progress / partially done · ⬜ not started

### Phase 1 — Infrastructure
- ✅ Backend deployed on Render — `https://wafina-api-rd0q.onrender.com` (Frankfurt, Starter tier)
- ✅ Verify production health — `GET /health` → `200 {"status":"ok"}`, confirmed live
- ✅ Review security and environment variables — done during RC1 prep (env var completeness,
  Firebase config, Drive config, upload limits, rate limiting, structured logging all verified;
  see `RELEASE_NOTES.md`). Two build-config bugs found and fixed along the way (TypeScript version
  drift causing `TS5107`; `NODE_ENV=production` omitting devDependencies during Render's build) —
  both fixed and pushed (`5ccb953`).

### Phase 2 — Web Applications
- ✅ Update all web apps to use the live Render API (`NEXT_PUBLIC_API_BASE_URL` in
  `apps/web`, `apps/institution`, `apps/admin` `.env.local`, plus new `.env.example` files
  documenting required vars — none existed before). Verified all three still build cleanly;
  found and fixed a real, previously-undetected `apps/admin` production-build bug along the way
  (`useSearchParams()` needed a Suspense boundary — Admin had never had a production build run
  before this).
- ✅ Convert all three apps to static export (`output: 'export'` in each `next.config.js`) —
  inspected all three for Server Components with data fetching, Route Handlers, middleware,
  `next/image`, dynamic routes, and `next/headers`/`cookies()` usage: none found in any of them.
  Every page is a `'use client'` component; the only Server Components are static root layouts.
  Empirically verified (not just theory) by building all three under `output: 'export'` and
  confirming real static HTML was produced for every route, before making the config change
  permanent. Also fixed two related gaps this surfaced: `out/` wasn't in `.gitignore`, and wasn't
  excluded from ESLint (was linting minified static output, producing 6708 false-positive errors).
- ✅ Deploy Donor Web — `wafina-donor-web` Render Static Site, live at
  `https://wafina-donor-web.onrender.com`. Verified: site loads, sign-in form renders, and a
  real disposable test account (`wafi.donor.test@gmail.com`) confirms Firebase Auth succeeds
  end-to-end against the production Firebase project (no "incorrect credentials" error). The
  subsequent call to our own API's `/auth/session` fails as expected — `ALLOWED_ORIGINS` on
  Render hasn't been updated yet (still `localhost` only); that's the planned next-but-one
  milestone, not a bug in this deploy.
- ✅ Deploy Institution Web — `wafina-institution-web` Render Static Site, live at
  `https://wafina-institution-web.onrender.com`. **Found and fixed a real deployment
  misconfiguration**: this service was initially created with `apps/admin`'s Build Command and
  Publish Directory instead of `apps/institution`'s (an easy mix-up given how similar the two
  config rows looked), so it was serving Admin's build under Institution's URL — confirmed by the
  page title reading "Wafina Admin" with a broken/empty body and several 404'd JS chunks. Fixed by
  correcting both fields in Render's Settings and redeploying; verified the title now correctly
  reads "Wafina Instituição" with no console/network errors, and a real disposable test account
  (`wafi.inst.test@gmail.com`) confirms Firebase Auth succeeds end-to-end against production.
- ✅ Deploy Admin Panel — `wafina-admin-panel` Render Static Site, live at
  `https://wafina-admin-panel.onrender.com`. Verified: no console/network errors, and a dummy
  credential correctly returns "E-mail ou palavra-passe incorretos" (proving Firebase Auth is
  reached; no real admin credentials were used for this check).
- ✅ Update `ALLOWED_ORIGINS` on Render (`wafina-api`) to include all three production URLs
  (alongside the existing localhost dev entries); confirmed the automatic redeploy completed and
  `/health` still returns 200.
- ✅ Verify complete end-to-end functionality — **Donor Web**: full real login
  (`wafi.donor.test@gmail.com`) → landed on the authenticated Home screen with correct profile
  data, Active Country, and notification badge. **Institution Web**: full real login
  (`wafi.inst.test@gmail.com`) → landed on the authenticated dashboard with correct real stats
  (1 published story, 5 items received total, etc., matching this account's known history).
  **Admin Panel**: build/CORS/Firebase-reachability confirmed, but a full authenticated login
  was not performed — no real Admin credentials were available this session (only a dummy
  credential was used, appropriately, to avoid needing real admin secrets in this workflow). Since
  Admin shares the identical auth code path and CORS config already proven working for the other
  two apps, this is very likely fine, but is flagged as the one item not fully closed — the
  stakeholder can confirm with a real admin login at their convenience.

**Deployment strategy decision: Render Static Sites** (revised from the original Web Service plan)
— for operational consistency with `apps/api`'s platform, and because all three apps turned out to
be fully static-exportable with zero functionality loss. This is free (no Starter-tier cost per
app), has no cold-start risk, and gets CDN distribution — likely better latency for a CPLP-wide
audience than a single Frankfurt container. Each app: Root Directory blank (monorepo needs
repo-root installs), Build Command `npm install --include=dev && npm run build:shared && npm run
build:ui && npm run build --workspace=apps/<app>`, Publish Directory `apps/<app>/out`. No Start
Command, no port handling needed — Static Sites just serve the built directory.

### Phase 3 — Store Preparation
- 🔶 Configure Google Play Console — account details confirmed (Support email `support@zuinder.com`,
  developer entity `ZUINDER - PRESTAÇÃO SERVIÇOS COMÉRCIO GERAL, LDA`, Account ID
  `6616179782244156480`, target region Global/Worldwide, primary language Portuguese (Portugal,
  `pt-PT`)). Store listing copy for Wafina Doador drafted (Title/Short/Full description). Store
  listing/Data Safety/Content Rating not yet submitted in-console.
- ✅ Application IDs finalized: `org.wafina.*` (the only values that existed in the codebase, found
  when the stakeholder asked to confirm them against a `com.zuinder.*` assumption) were changed to
  `com.zuinder.wafina.doador` (Wafina Doador) and `com.zuinder.wafina.instituicao` (Wafina
  Instituição) in both apps' `app.json` (`ios.bundleIdentifier` and `android.package`), matching the
  registered developer entity. Zero-risk change confirmed before applying: no native `android`/`ios`
  folders exist yet (managed Expo workflow, no `expo prebuild` run), no EAS project registered, no
  Play Console/App Store Connect app created yet — these were the only two files referencing the old
  IDs anywhere in the repo.
- ✅ Account deletion request page — Google Play's Data Safety form requires a web link users can use
  to request account/data deletion. Checked the codebase first: **no in-app self-service account
  deletion exists anywhere** (Donor/Institution, web or mobile). Built a bilingual `/delete-account`
  page on Donor Web as the immediate, low-risk fix for the required web link (support-mediated:
  email `support@zuinder.com`, processed within 30 days, states what's deleted vs. what's retained
  anonymized for impact stats).
- ✅ **In-app account deletion — scope decided and implemented, 2026-08-02.** Two real gaps found and
  fixed: (1) the `/delete-account` page existed but wasn't linked from *any* app's Settings screen —
  now linked from Donor Web/mobile and Institution Web/mobile. (2) True self-service deletion (an
  actual "Delete My Account" action, not just a support request) didn't exist at all — built for
  **Donor accounts only** (stakeholder-approved scope; Institution stays support-mediated, since an
  institution's name/logo/verification is displayed platform-wide and is a smaller, relationship-
  managed user base). New `DELETE /donor/account` deletes the Firebase Auth user and anonymizes the
  `Users` row (Name/Phone/Email cleared, `Corporate_Account_ID` cleared, `Show_Name_To_Institutions`
  forced off, new `Status: 'Deleted'`) — Donations/Success_Stories need no changes at all since they
  already reference the donor only by ID and already render a missing/anonymized donor as anonymous.
  `requireAuth` now rejects any `Status !== 'Active'` (was `=== 'Suspended'` only) so a deleted
  account is locked out immediately even before its Firebase token would naturally expire. A real
  bug was caught and fixed **before** this shipped: the first pass left `Email` on the row, which
  would have permanently blocked that address from ever registering again (`findUserByEmail` matches
  on it) — fixed by clearing `Email` too, verified by confirming `findUserByEmail` returns null for
  the old address post-deletion. Verified end-to-end against live production data: a disposable
  donor account was created, its full deletion flow run through the real Donor Web UI (wrong-email
  confirmation correctly blocked, correct email enabled it), confirmed `DELETE /donor/account` → 204,
  confirmed the Firebase user no longer exists, confirmed the Sheets row shows every field cleared
  and `Status: Deleted`, then confirmed the Email-clearing fix specifically via a second, isolated
  test. All disposable test rows cleared afterward. Institution Web's new link confirmed rendering
  with the correct URL via a live authenticated session. Mobile (Donor + Institution) changes are
  typecheck/lint-clean but not run in a simulator this cycle — same known gap already tracked for
  the previous feature in `RC1_REGRESSION_TEST_CHECKLIST.md`.
- ⬜ Configure Apple App Store Connect
- ✅ **Complete all required compliance information — drafted, 2026-08-02.** Verified against the actual
  code (not assumed) that: no ad/payment/analytics/tracking SDK exists anywhere, no third-party social
  login exists (Firebase email/password only, so Apple's Sign in with Apple requirement does not
  trigger), no background location or age/birthdate collection exists, and the only `node:crypto` usage
  is ID generation (qualifies for Apple's standard export-compliance exemption). Produced
  `COMPLIANCE_INFORMATION.md` with ready-to-paste answers for Google Play's App content declarations
  (Ads/News/COVID/Government/Financial Features/Target audience/Content rating) and Apple App Store
  Connect's compliance section (Export compliance, Age rating, App Privacy, Content rights). Flagged one
  genuine open item needing a stakeholder decision, not silently built: no in-app "report content" or
  post-publish removal mechanism for Success Stories (Apple Guideline 1.2 / Play's UGC policy) — Admin
  pre-publish moderation and account suspension exist today, which is a defensible launch posture, but
  stronger UGC controls are optional, not built without approval. Submission into both consoles is the
  stakeholder's action (no console credentials held in this environment).
- ✅ Prepare Privacy Policy and Data Safety information — bilingual (PT/EN) Privacy Policy written and
  published as a static page at `https://wafina-donor-web.onrender.com/privacy` (added to `apps/web`,
  zero new infrastructure — reuses the existing live Donor Web static site). Covers both mobile apps
  and all three web apps under one canonical URL, accurately describing actual data practices verified
  against the codebase (Firebase Auth account fields Name/Phone/Home_Country_ID, GPS location for
  pickup/institution address, photo uploads, Google Sheets/Drive as processors, no push notification
  tokens collected — confirmed no `expo-notifications` integration exists, notifications are in-app
  only, no ad tracking, no data sale). Verified: production static build succeeds with the new route,
  full `npm run lint` + `npm run typecheck` clean, rendered and screenshot-checked locally before
  publishing.
- ✅ **Scope broadening (stakeholder-directed, 2026-08-02, Feature Freeze exception explicitly
  approved):** the platform now explicitly covers both perishable (fresh food, prepared meals) and
  non-perishable goods, not non-perishable-only. Real product change, not just copy — found during
  Terms drafting that `packages/shared/src/enums/item-type.ts` had no food category at all (only
  Roupas/Sapatos/Cobertores e roupa de cama/Material escolar), which would have made the store listing
  claim a capability the app didn't have. Added `Alimentos frescos`, `Refeições preparadas`, and
  `Mercearia/Alimentos não perecíveis` to the shared `ITEM_TYPES` list — this is a plain string array
  already consumed identically by the Donor Web and Donor mobile item-type selectors and displayed
  as-is (no fixed dropdown) everywhere Admin/Institution show `Item_Type`, so one shared-package edit
  propagated everywhere with no per-app UI code changes needed. `MASTER_SPECIFICATION.md` §1.1 and the
  Privacy Policy's scope sentence updated to match. Added a new bilingual **Terms & Conditions** page
  at `https://wafina-donor-web.onrender.com/terms`, including a food-safety/item-responsibility
  disclaimer (donor responsible for perishable items being safe/unexpired at transfer; institution
  responsible for inspecting at collection; Wafina is an intermediary, not a party to the physical
  exchange). Deliberately did **not** mention future monetary/cash donations anywhere in the Terms,
  Privacy Policy, or store-facing copy, per the stakeholder's explicit instruction, to avoid store
  review confusion. Verified: `npm run lint` + `npm run typecheck` clean across all 8 workspaces,
  production static build succeeds (now 15 routes including `/terms`), and the new categories were
  confirmed live in the real donation-creation dropdown via an authenticated browser session with a
  disposable test account (`wafi.donor.test@gmail.com`) — all 7 item types present and in the expected
  order.
- ✅ **Corporate Invitation Codes — verified complete and production-ready.** A stakeholder request to
  build this feature turned out to be ~95% already live from the earlier Admin Web App Parity work;
  verified every piece against the real running code and live production data rather than rebuilding.
  The one genuine gap (no copy-to-clipboard button on a generated code) is now fixed and live-tested
  end-to-end with a disposable throwaway Admin account (created, tested, fully deleted afterward — no
  leftover test data). Full workflow, capabilities, and limitations documented in
  `CORPORATE_INVITATION_CODES.md`.
- ✅ **Individual vs. Corporate donation attribution — implemented and verified.** Fixed a real
  business-logic gap the stakeholder flagged: previously any donation by a company-linked donor was
  automatically counted as corporate. Recommended (and got sign-off on) a simpler schema than
  proposed — a nullable `Corporate_Account_ID` directly on `Donation`, instead of a separate type
  field — which removes a join rather than adding one. Donor now chooses per donation (default
  Personal); the donor-company link never changes. `/donations/mine` simplified to always show the
  donor's own donations only (clarified with the stakeholder — dropped the old "company-wide view"
  behavior), each one now labeled 👤 Doação Pessoal or 🏢 Doação da Empresa. Admin's company
  `Donation_Count` fixed to count only explicitly-corporate donations. One-off schema migration added
  the column to the live `Donations` sheet (existing rows read as blank/personal, correctly). Verified
  end-to-end against a local API instance pointed at real data — disposable donor + disposable
  company, one Individual and one Corporate donation, confirmed correct `Corporate_Account_ID` on
  each, confirmed `/donations/mine` returns both, confirmed company `Donation_Count` was 1 not 2 —
  then fully cleaned up. See `CORPORATE_INVITATION_CODES.md` for the updated workflow.
- ✅ **Post-deployment regression + smoke test — PASS, 23/23, zero regressions.** Confirmed the Render
  auto-deploy had already picked up both the API and Donor Web changes before testing began. Full
  targeted regression (registration, login, password reset, invitation-code redemption, both donation
  types' attribution, "Minhas Doações" own-only + labels, Institution claim→schedule→collect→deliver
  on both types, Admin `Donation_Count`, Impact Stories create/approve/visibility) plus the requested
  smoke test all passed against live production. No bugs found — RC1 is stable and ready to continue
  to the next milestone.

### Phase 4 — Release Builds
- ✅ Generate Android APK/AAB — both apps built via EAS, see `RELEASE_NOTES.md` (2026-08-03)
- ✅ Generate iOS IPA — both apps built and submitted (see Phase 7)
- ✅ Verify build integrity — real Firebase/API config confirmed baked in (not `localhost`), see `RELEASE_NOTES.md`

### Phase 5 — Real Device Testing
- ✅ Test Android on a real device — full Donor + Institution workflow live-tested 2026-07-31 (see `PROJECT_STATUS.md`)
- ✅ Test iPhone build — apps are live on the App Store (confirms this happened at some point; not independently documented in this file)
- ✅ Complete role-play scenarios covering Donor, Institution — done 2026-07-31 (Admin role-play not explicitly documented)
- ✅ Document every issue found — see `PROJECT_STATUS.md` 2026-07-31 entry (photo upload bug, auth-failure bug, both fixed)
- ✅ Fix issues — both real bugs found were fixed same session
- ✅ Rebuild if necessary — subsequent builds happened (apps are live)

### Phase 6 — Store Assets
- ✅ Icons — official Wafina branding frozen 2026-08-03 (`branding/WAFINA_BRAND_GUIDE.md`): master color
  `bougainvillea700`, D/I/A badge system, wired into `app.json` (Donor/Institution) and all three web
  favicons. Verified against real platform masking (circle/squircle/rounded-square), minimum sizes down to
  16px, and iOS's no-alpha-channel requirement — see the branding freeze checklist for full detail.
- ⬜ Splash screens
- ⬜ Screenshots — see "Screenshot capture plan" below; blocked on a logged-in device session,
  which Claude cannot do on the stakeholder's behalf
- ✅ Feature graphics — 2026-08-04, Play Store 1024×500 feature graphic for both apps, built from
  the frozen brand assets (icon, master color, Fraunces/WorkSans type). See
  `branding/store-assets/play-feature-graphic-{donor,institution}.png`
- ✅ Store descriptions — 2026-08-04, Title/Short/Full description for both apps, PT-PT + EN. See
  `STORE_LISTING_COPY.md`
- ✅ Keywords — 2026-08-04, Apple keyword fields for both apps included in `STORE_LISTING_COPY.md`
- ⬜ Website
- ✅ Support email — `support@zuinder.com`, already confirmed in Play Console account details and
  used throughout Privacy Policy/Terms/delete-account pages (checkbox here was just stale)
- ✅ Privacy Policy — published at `/privacy` on Donor Web since Phase 3 (checkbox here was just
  stale; see Phase 3 entry above)

### Screenshot capture plan

Store screenshots require navigating the app while signed in. Claude does not sign in or enter
credentials on the stakeholder's behalf (hard rule, not a judgment call), so this can't be
automated end-to-end. Workable path: the stakeholder navigates each key screen on the connected
device (same phone/adb setup already used for real-device testing) and shares the raw screenshots;
Claude then adds device framing, captions, and consistent styling using the frozen brand identity
— no login or app interaction required for that half of the work.

**Note (2026-08-02):** the stakeholder issued a detailed 18-category "Brand Package" master prompt
(Brand Guidelines, icons, Google Play/Apple assets, screenshots, feature graphic, social media kit,
press kit, website graphics, marketing materials, source files) covering this phase in agency-level
detail. Explicitly deferred until this phase starts — see memory `rc1-brand-package-deferred` for the
full brief, the tooling reality-check (no image-generation tool available; illustration/photography/
print-ready/Figma-AI deliverables need a design tool or human designer instead), and the stakeholder's
decision to formalize the existing CSS text+dot mark (`apps/web/src/app/globals.css` `.app-mark`) into
a real SVG logo rather than inventing a new one.

### Phase 7 — Store Submission
- ✅ Upload AAB to Google Play Console — Donor live; Institution submitted, awaiting review (per stakeholder, 2026-08-23)
- ✅ Upload IPA to App Store Connect — both Donor and Institution live on the App Store (per stakeholder, 2026-08-23)
- ✅ Complete store review checklists — implied by the above having passed review
- 🔶 Submit both applications — iOS both apps: done. Android: Donor done, Institution pending Google's review

### Phase 8 — Project Handover & Operations Package
- ⬜ Project architecture
- ⬜ GitHub repositories
- ⬜ Render configuration
- ⬜ Firebase configuration
- ⬜ Google Cloud information
- ⬜ Google Sheets IDs
- ⬜ Google Drive IDs
- ⬜ Environment variable inventory
- ⬜ API documentation
- ⬜ Domain and DNS information
- ⬜ Test accounts
- ⬜ Deployment guide
- ⬜ Backup & disaster recovery procedures
- ⬜ Maintenance procedures
- ⬜ Monthly costs
- ⬜ Third-party services
- ⬜ Release history
- ⬜ Future roadmap

### Phase 9 — Production Acceptance
- ⬜ Final production verification
- ⬜ Confirm every module works
- ⬜ Produce a Production Readiness Report
- ⬜ Obtain final launch approval

### Phase 10 — Launch
- ✅ Publish the applications — iOS: both Donor and Institution live on the App Store. Android: Donor
  live on Google Play, Institution submitted and awaiting Google's review (per stakeholder, 2026-08-23)
- 🔶 Monitor production — no formal process documented; ad hoc only so far
- ⬜ Resolve any critical issues — no formal tracking process for post-launch issues yet
- 🔶 Prepare Version 1.1 planning — `VERSION_2_ROADMAP.md` exists and is actively being added to

## Current Position

**Note (2026-08-23):** this section was last accurate as of 2026-08-02. Real progress continued well
past that date without this file being updated in step — see below for the corrected picture, confirmed
directly with the stakeholder rather than assumed from commit history alone.

**V1 has effectively launched.** iOS (Donor + Institution) is live on the App Store; Android Donor is
live on Google Play; Android Institution is submitted and awaiting Google's review. Phases 1, 2, 4, 5,
and most of 3 and 7 are done in substance, even though their checkboxes above had drifted out of sync
with reality — corrected in this pass.

**What's genuinely still open:**
1. **Android Institution** (🔶) — waiting on Google Play review; nothing to do but wait unless it's
   flagged.
2. **Phase 8 (Handover Package)** (⬜) — architecture docs, credentials inventory, deployment guide,
   etc. not yet built.
3. **Phase 9 (Production Acceptance)** (⬜) — no formal "confirm every module works in production" pass
   or sign-off has happened since launch.
4. **Push notifications (OS-level)** — code shipped 2026-08-22 as infrastructure only, explicitly *not*
   included in the build currently live/in-review on either store. Session of 2026-08-23 found and fixed
   a real gap: neither platform had its push delivery credential configured (Android FCM V1, iOS APNs
   key) — both are now set up for both apps (Donor + Institution), reusing one APNs key across both iOS
   apps since APNs keys are Apple-Team-wide, not per-app. **Still not tested end-to-end on a real
   device, and no build yet exists containing this code** — needs a fresh EAS build (blocked on the
   stakeholder's EAS cloud build allowance as of 2026-08-23) before it can reach a real device, let alone
   real users.
5. **V2 feature work** (donor loyalty tiers, corporate accounts/invitations, Admin parity, GPS distance
   matching, multi-photo donations, full EN/PT localization) has shipped continuously to `main` in
   parallel with the live V1 apps throughout August 2026 — worth the stakeholder explicitly confirming
   this parallel-track approach is intentional, since a V2 backend change could in principle affect what
   the already-live apps depend on.

Per the operating rules above, confirm with the stakeholder which of the open items above to tackle
next before starting new work.
