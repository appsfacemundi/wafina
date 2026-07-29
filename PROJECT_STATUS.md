# Project Status - WAFINA Platform

**Last updated:** 2026-07-29
**Updated by:** Claude Code, after recovering and closing out prior Android verification work
**Current state:** Donor + Institution fully verified on Web, iOS, and Android. Ready to begin Phase 3.

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

**Status:** Not started. This is the next milestone.

**Scope, in order to be worked through:**
- Business logic
- User journeys
- Google Sheets database structure & table relationships
- Permissions and security
- Notifications
- Workflows
- Reports
- Validation rules
- Edge cases
- Performance
- Scalability
- UI/UX consistency
- Data integrity

**Method:** Don't just review code — critically evaluate whether each workflow is intuitive,
efficient, scalable, and production-suitable. Identify simplification/modernization opportunities
that preserve business objectives (per `DEVELOPMENT_RULES.md` — never change business logic without
approval).

**Classification & approval gate:**
- **Minor** → implement automatically
- **Medium** → explain impact, wait for approval
- **Major** → explain impact, wait for approval

**Explicit constraint:** Do not rebuild the Admin Panel during Phase 3. That begins only after
Phase 3 is completed and approved.

---

## Next Steps

1. Begin Phase 3 review (see scope above)
2. As findings are classified, implement Minor items directly; present Medium/Major items for approval before touching code
3. Keep this file updated after each major milestone (Phase 3 kickoff, each approved batch of changes, Phase 3 close-out)

---

## Key File Locations

- `DEVELOPMENT_RULES.md` — binding development constraints (read before any architectural change)
- `MASTER_SPECIFICATION.md` — complete business requirements, single source of truth for business logic
- `apps/mobile-donor/`, `apps/mobile-institution/` — mobile app source
- `apps/web/`, `apps/institution/` — web app source
- `apps/api/` — REST API + Google Sheets integration
