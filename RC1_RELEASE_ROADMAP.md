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
- ⬜ Deploy Institution Web
- ⬜ Deploy Admin Panel
- ⬜ Verify complete end-to-end functionality
- ⬜ Update `ALLOWED_ORIGINS` on Render to the real deployed web URLs

**Deployment strategy decision: Render Static Sites** (revised from the original Web Service plan)
— for operational consistency with `apps/api`'s platform, and because all three apps turned out to
be fully static-exportable with zero functionality loss. This is free (no Starter-tier cost per
app), has no cold-start risk, and gets CDN distribution — likely better latency for a CPLP-wide
audience than a single Frankfurt container. Each app: Root Directory blank (monorepo needs
repo-root installs), Build Command `npm install --include=dev && npm run build:shared && npm run
build:ui && npm run build --workspace=apps/<app>`, Publish Directory `apps/<app>/out`. No Start
Command, no port handling needed — Static Sites just serve the built directory.

### Phase 3 — Store Preparation
- ⬜ Configure Google Play Console
- ⬜ Configure Apple App Store Connect
- ⬜ Complete all required compliance information
- ⬜ Prepare Privacy Policy and Data Safety information

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
