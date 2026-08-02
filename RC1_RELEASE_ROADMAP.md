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
- ⬜ Update all web apps to use the live Render API (`NEXT_PUBLIC_API_BASE_URL`)
- ⬜ Deploy Donor Web
- ⬜ Deploy Institution Web
- ⬜ Deploy Admin Panel
- ⬜ Verify complete end-to-end functionality
- ⬜ Update `ALLOWED_ORIGINS` on Render to the real deployed web URLs

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
