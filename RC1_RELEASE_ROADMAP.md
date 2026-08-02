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
  anonymized for impact stats). **Open item, not yet decided:** Play generally also expects true
  in-app deletion when an app supports account creation, not just a support-mediated web request —
  that would be real backend work (safely deleting a `Users` row plus related donations/history) and
  needs a stakeholder decision on scope/timing, not something to build silently.
- ⬜ Configure Apple App Store Connect
- ⬜ Complete all required compliance information
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

### Phase 4 — Release Builds
- ⬜ Generate Android APK
- ⬜ Generate Android AAB
- ⬜ Generate iOS IPA
- ⬜ Verify build integrity

### Phase 5 — Real Device Testing
- ⬜ Test Android APK on a real Android phone
- ⬜ Test iPhone build through TestFlight
- ⬜ Complete role-play scenarios covering Donor, Institution, and Admin
- ⬜ Document every issue found
- ⬜ Fix issues
- ⬜ Rebuild if necessary

### Phase 6 — Store Assets
- ⬜ Icons
- ⬜ Splash screens
- ⬜ Screenshots
- ⬜ Feature graphics
- ⬜ Store descriptions
- ⬜ Keywords
- ⬜ Website
- ⬜ Support email
- ⬜ Privacy Policy

### Phase 7 — Store Submission
- ⬜ Upload AAB to Google Play Console
- ⬜ Upload IPA to App Store Connect
- ⬜ Complete store review checklists
- ⬜ Submit both applications

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
- ⬜ Publish the applications
- ⬜ Monitor production
- ⬜ Resolve any critical issues
- ⬜ Prepare Version 1.1 planning after launch

## Current Position

**Phase 1 is functionally complete**, pending your confirmation to mark it closed and move to Phase 2
(updating the web apps' API base URL and deploying them). Per the operating rules above, no Phase 2
work will begin until that confirmation is given.
