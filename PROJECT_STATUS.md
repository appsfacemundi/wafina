# Project Status - WAFINA Platform

**Last updated:** 2026-07-29
**Updated by:** Claude Code, after completing Phase 3A Module 1 (Global Multi-Country & Geographic Architecture)
**Current state:** Phase 3 review complete. Phase 3A underway, working module by module. Module 1 (the permanent geographic/country data model) is designed, approved, implemented, and verified against the real production Sheet. Module 2 (Notification Architecture) design is being revised to include newly-requested events before implementation.

---

## Purpose of this file

This file is the persistence layer across sessions. Read it FIRST at the start of any new session,
before asking the stakeholder what's already been done — the answer is almost always recoverable from
here, from git history, or from prior session transcripts. Update it after every major milestone.

---

## Overview

WAFINA is a nonprofit donation-matching platform with three applications:
- **Donor App** (`apps/mobile-donor`, `apps/web`): React Native/Expo + Next.js
- **Institution App** (`apps/mobile-institution`, `apps/institution`): React Native/Expo + Next.js
- **Admin Panel**: AppSheet (permanent, never rebuilt — see `DEVELOPMENT_RULES.md` §3)
- **REST API** (`apps/api`): Node.js, reads/writes Google Sheets directly

---

## Completed Work

### ✅ Donor App — Web, iOS, Android (Modules 1–4c + Settings)
Auth (sign up/in via Firebase), onboarding/profile, Donate workflow (photo + GPS), browse verified
institutions, track donation status, notifications, settings/sign out.

### ✅ Institution App — Web, iOS, Android (Modules 5–7)
Auth, registration/onboarding (GPS capture), verification-status gate, browse/claim donations,
confirm receipt, disputes (raise/view), notifications, settings.

### ✅ API & Backend
REST endpoints for all workflows above, Firebase auth integration, Google Sheets connectivity,
notifications, change-requests, disputes.

### ✅ Full cross-platform verification pass (2026-07-27 → 2026-07-29)
All 6 combinations — Donor×{Web,iOS,Android}, Institution×{Web,iOS,Android} — walked through
end-to-end with real Firebase test accounts and real Google Sheets data, then cleaned up.
Full detail in "Android Verification — Recovered History" below.

---

## Android Verification — Recovered History

**Why this section exists:** a prior session (transcript `ef34f70f-7cbe-4152-bd0c-caea26d993e2`,
2026-07-27 17:59 → 2026-07-29 18:06) completed this work, but the session ended before it was
committed to git — the changes sat in a `git stash` ("Teleport auto-stash") until this session
recovered and committed them. Recorded here in detail so no future session re-does it.

### What was verified

**Donor Mobile Android** (task completed 2026-07-28T23:44): Sign In (validation), Sign Up (real
Firebase account), Onboarding profile (all fields, real submission → landed on Home), and all 6 tabs
individually confirmed rendering cleanly: Início, Doar, Minhas Doações, Instituições, Notificações,
Definições. Test account cleaned up afterward; real donations confirmed untouched.

**Institution Mobile Android** (task completed 2026-07-29T17:16): Sign Up, Registration (GPS —
both coarse and fine location permission dialogs), submission → correctly auto-navigated to
"Estado de verificação" (confirms the registration-refetch fix works on Android), simulated Admin
verification, signed back in, Home dashboard with real verified data, and all 6 tabs confirmed:
Início, Disponíveis, Reclamadas, Disputas, Notificações, Definições. Test account cleaned up
afterward; real data confirmed untouched.

**Known gap (accepted, not a blocker):** on Android specifically, Reclamadas/Disputas were verified
as clean empty-state renders, not a live claim → confirm → dispute action. That full functional
cycle was exercised with real Sheet writes on Web and on iOS (same JS bundle, same API calls).
Low risk; flagged here rather than silently assumed away.

### Bugs found and fixed during this pass (apply to both apps)

| # | Bug | Fix | Commit status |
|---|---|---|---|
| 1 | Status-bar overlap on 5/6 tab screens per app | `useSafeAreaInsets()` | Committed (pre-existing) |
| 2 | Tab label truncation ("Instituições"/"Notificações") | Auto-shrinking text | Committed (pre-existing) |
| 3 | Tofu/missing-icon box on Android tab bar (React Navigation `MissingIcon` fallback, invisible on iOS, visible box on Android) | `tabBarIcon: () => null` in both `RootNavigator.tsx` | **Committed 2026-07-29 (this session, recovered from stash)** |
| 4 | Institution registration dead-end — `useOwnInstitution` never refetched after registering, stranding the user on the Register screen forever | Added `refetch()`, wired via `onRegistered` | Committed (pre-existing) |
| 5 | Disputes list: full donation UUID didn't wrap, pushing the status badge off-screen | `flex: 1` + `flexWrap: 'wrap'` on the ID text | **Committed 2026-07-29 (this session, recovered from stash)** |

### Evidence trail
- Session transcript: `~/.claude/projects/-Users-zuinder-Downloads-WAFINA-PROJECT/ef34f70f-7cbe-4152-bd0c-caea26d993e2.jsonl`
- 24 real Android emulator screenshots captured during testing (session scratchpad, `android45.png`–`android68.png`)
- `git stash@{0}` ("Teleport auto-stash") held the 2 uncommitted fixes + a leftover verification script — recovered and committed 2026-07-29
- Environment note from that session: this Mac's Android emulator is resource-constrained (triggered one full OS reboot, several silent process deaths during testing). If reactivating it, re-run `adb reverse tcp:4000 tcp:4000` after any emulator restart — the port mapping doesn't survive it.

---

## Phase 3 — Complete Architecture & Business Logic Review

**Status:** COMPLETE. Full report at `PHASE3_ARCHITECTURE_REVIEW.md` (project root) — read that file for
the full findings, not this summary.

**Method used:** Full re-read of `MASTER_SPECIFICATION.md` (all 32 sections) + `DEVELOPMENT_RULES.md`,
5 parallel deep-research passes (backend/DB/API, notifications, Donor mobile UX, Institution mobile UX,
both web apps), plus direct first-hand verification of every headline claim against actual source code —
not taken on a sub-agent's word alone.

**Headline findings (see the full report for all ~30 classified recommendations):**
1. **[MAJOR]** No bridge from Admin actions (AppSheet) back into the app — institutions currently have
   no way to learn they've been verified/rejected except repeatedly reopening the app. 4 of 7 spec'd
   notification events can never fire under the current architecture.
2. **[MAJOR]** N+1 performance pattern on the Institutions browse screen — every institution's stats
   trigger a full re-read of the entire Donations tab. No caching/pagination/retry anywhere in the
   Sheets access layer.
3. **[MAJOR]** Multi-country is not yet a data concept — `Users.Country` exists but is used nowhere;
   Institutions/Donations have no country field at all.
4. **[MAJOR]** Zero automated tests exist, despite spec §31 requiring them.
5. **[MAJOR]** Zero i18n scaffolding and zero accessibility props anywhere, despite dev rules requiring
   i18n-readiness from day one.

**Production readiness score:** ~64% for a controlled Angola pilot (the near-term goal per spec's own
phased rollout); ~34% for the stated long-term goal of a multi-country platform serving millions — these
are two different bars and the report scores both separately rather than blending them into one
misleading number.

**Minor items — implemented and committed this session:**
- Removed hardcoded `pt-PT` locale from 6 date-formatting call sites (now uses device default)
- Deleted a stale, schema-mismatched dead script (`tmp-seed-donation.ts`)
- Fixed forced `autoCapitalize="none"` on 3 proper-noun name fields

**Medium/Major recommendations:** NOT implemented. All ~27 remaining items are documented in the full
report with impact/DB implications, classified, and organized into a 5-phase roadmap (Phase 3a pre-launch
hardening → 3b post-launch hardening → Phase 4 multi-country → Phase 5 growth features → deferred
post-V1 items). Waiting on stakeholder approval before touching any of them.

**Explicit constraint honored:** Admin Panel (AppSheet) was not touched or scoped for redesign — reviewed
only where its behavior affects the Donor/Institution apps' workflows, per instruction. That rebuild
begins only after Phase 3's Medium/Major items are approved and (at least Phase 3a) implemented.

---

## Phase 3A — Foundation Hardening & Global Platform Architecture

**Status:** IN PROGRESS. Working module by module per stakeholder's explicit process: design → explain →
approval (Medium/Major) → implement → report → update this file, before starting the next module.

### Module 1 — Global Multi-Country & Geographic Architecture: COMPLETE

**What changed:**
- New permanent data model: a single self-referencing `Geo_Regions` tab (`Region_ID`, `Name`, `Level`,
  `Parent_Region_ID`, `Country_ID` [denormalized ancestor pointer], `ISO_Code`, `Active`) instead of
  fixed Country/Province/Municipality tables — supports any country's real administrative depth without
  a schema change. Seeded with 5 countries: Angola (`Active=TRUE`), Portugal/Brazil/Moçambique/Cabo Verde
  (`Active=FALSE`, ready to launch by flipping one flag).
- `Users`: added `Home_Country_ID`, `Active_Country_ID`, `Switch_Preference` (`Always_Ask` /
  `Never_Ask_Automatically`). Replaced the old free-text `Country` field entirely (was already only
  test data — one row even had `Country="Luanda"`, a province, not a country, which is exactly the drift
  a real FK prevents). "Current GPS Country" is deliberately **not stored** — computed client-side each
  session, see `packages/shared/src/lib/geo-detect.ts`.
- `Institutions`: added `Country_ID` (required), `Region_ID` (optional, for future Province/Municipality/
  District), `Service_Radius_Km`, `Coverage_Area`.
- `Donations`: added `Country_ID` — a **permanent snapshot** of the donor's Active Country at submission
  time, not a live join. This was a deliberate correction to my own earlier Phase 3 recommendation (which
  suggested deriving it live) once Active Country became a real, user-changeable concept — a live join
  would let a donation silently "move" countries if the donor later travels. Flagged and explained rather
  than silently changed.
- New API: `GET /geo-regions/countries`, `GET /geo-regions/:id/children`, `PATCH /users/me/active-country`,
  `PATCH /users/me/switch-preference`. `listVerifiedInstitutions`/`listAvailableDonations` now take an
  optional country filter; Donor-side browsing filters by the donor's Active Country, Institution-side
  browsing filters by the institution's own `Country_ID` (its operating country, not a personal toggle).
- New client UX: real country pickers (replacing free text) on Donor onboarding, Donor Settings, and
  Institution registration; a "País ativo" section in Donor Settings (view/change Active Country, set
  switch preference); a GPS-assisted switch-country prompt (mobile + web) that runs once per session on
  Home, using free on-device bounding-box country inference — never auto-switches, always requires an
  explicit tap.

**Why:** This is the foundational data model every other multi-country capability (institutions, reports,
notifications, dashboards, maps, future payment/transport/government integrations) depends on. Building
it first, correctly, means nothing downstream needs to be redesigned later.

**Benefits:** Wafina can now, in principle, launch a second country by seeding `Geo_Regions` data and
flipping `Active=TRUE` — no redeploy, no schema change. Donors and institutions are cleanly scoped to
the right country by default. A user who travels stays in control: nothing switches without an explicit
tap, and past donations never retroactively move.

**Database implications:** One new tab (`Geo_Regions`, 5 rows today). Additive-only column changes to
`Users`/`Institutions`/`Donations` — existing columns were never removed, reordered, or overwritten, so
AppSheet/Admin views bound to the current layout are unaffected. All 7 existing Users, 4 Institutions, and
23 Donations rows were backfilled to Angola (the only launched market) and verified row-by-row.

**A pre-existing bug surfaced during backfill (not introduced by this module):** `Institutions` has a
duplicate `Institution_ID="bdecb4ed"` — exactly the issue already documented in `MASTER_SPECIFICATION.md`'s
Appendix (item 1) as a known reference-implementation problem requiring production uniqueness enforcement.
It made the key-based `updateRow` helper only reach the first of the two rows during backfill; fixed by
targeting the second row's actual sheet position instead of its (ambiguous) ID. The underlying
duplicate-key problem itself is unresolved — that's the uniqueness-enforcement hardening work already
queued in the Phase 3 report (`DB-1`/general uniqueness gaps), not something patched here.

**Verified:** `npm run typecheck` and `npm run lint` clean across all 7 workspaces. Real HTTP smoke test
(new routes return proper 401s when unauthenticated, confirming middleware wiring). Real service-layer
smoke tests against the live, migrated data: country filtering returns correct institution/donation counts
and empty results for a nonexistent country; `createInstitution`/`createDonation` correctly reject
missing, unknown, and inactive countries. No stray test data left behind (row counts confirmed unchanged
after validation tests, which are designed to throw before any write).

**Not done in this module (explicitly deferred):**
- Country-scoped Admin — deferred to the future Admin Panel rebuild, per instruction not to touch it yet.
- Province/Municipality/District data — schema supports it (`Region_ID`, arbitrary `Level` depth), but no
  rows exist below Country level yet. Pure future data entry, no code change needed.
- Country Configuration (language/currency/transport partners/etc. per country) — explicitly deferred per
  instruction; `Country_ID` is the extension point a future `Country_Config` table would key off.

### Module 2 — Notification Architecture: DESIGN IN PROGRESS

Original design (2 wired events → complete 7-event matrix) was approved. The same approval message added
significant new scope (dispute created, change request submitted/approved, corporate invitation
accepted/member joined, transport volunteer accepted/completed, success story published → notify donor).
Two of these (transport volunteer, success story) depend on features that don't exist yet in the codebase
at all (no Transport/Volunteer entity, no Success Stories entity) — revising the design to sequence what's
immediately buildable against what needs its underlying feature built first, before implementing anything,
consistent with how BL-1 (the Admin bridge) was already identified as a prerequisite for several events.

### Modules 3–7: not yet started
Database hardening, security hardening, UX pass — sequenced after Module 2's design is settled, per the
stakeholder's explicit module-by-module process.

---

## Next Steps

1. Stakeholder reviews `PHASE3_ARCHITECTURE_REVIEW.md` and approves/adjusts which Medium/Major items to
   implement and in what order (the report proposes a 5-phase roadmap as a starting point, not a mandate).
2. Implement approved items in the agreed order, updating this file after each phase closes.
3. Only after Phase 3a (pre-launch hardening) is implemented and approved should a production launch be
   considered ready per this review's own findings.
4. Admin Panel redesign begins only after Phase 3 is fully approved (per explicit instruction).

---

## Key File Locations

- `DEVELOPMENT_RULES.md` — binding development constraints (read before any architectural change)
- `MASTER_SPECIFICATION.md` — complete business requirements, single source of truth for business logic
- `apps/mobile-donor/`, `apps/mobile-institution/` — mobile app source
- `apps/web/`, `apps/institution/` — web app source
- `apps/api/` — REST API + Google Sheets integration
