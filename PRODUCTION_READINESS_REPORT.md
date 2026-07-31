# WAFINA — Production Readiness Report

**Date:** 2026-07-31 (updated same day after the production-hardening round: rate limiting, structured
logging, a Sheets backup mechanism, a silent auth-failure bug fix, and a full backend i18n sweep)
**Prepared by:** Claude, at the stakeholder's request, following the Platform Stabilization phase and the
Google Sheets rate-limit resilience fix (see `PROJECT_STATUS.md` for full history).
**Purpose:** a single go/no-go assessment before starting any new feature module — completion status,
outstanding bugs, security/performance/database/scalability review, and a launch checklist.

This report is a snapshot assessment, not new development. Every claim below is grounded in either the actual
codebase (checked while writing this, not recalled from memory) or the accumulated `PROJECT_STATUS.md` record
of live-tested work this project. Where I'm giving a judgment call rather than a verified fact, I've said so.

**Version 1.0 is now under Feature Freeze** (`DEVELOPMENT_RULES.md` §16): no new functionality until launch
unless it fixes a bug, a security issue, a production-readiness issue, or is required for an existing
workflow to function correctly. New ideas go to `VERSION_2_ROADMAP.md` instead.

---

## 1. Executive Summary

**Recommendation: ready for a controlled pilot launch (single country, small user base, active monitoring),
not yet ready for an unmonitored public launch.**

The core donor→institution→admin donation lifecycle — including multi-country architecture, Success Story
moderation, notifications, and now a genuinely full-featured Admin Web App — is functionally complete and has
been repeatedly live-tested end-to-end, most recently in one continuous real workflow covering every step
from donation creation through Success Story approval and cross-app propagation, and again during this
update while directly verifying each link in the chain.

What stands between here and an unmonitored public launch is not missing core functionality — it's the
absence of an automated test suite, a handful of real but non-blocking security/performance items (detailed
below), and features that were explicitly scoped out as "not needed yet" (Settings/feature flags) or
deliberately deferred by the stakeholder (Active-Country filtering audit, Phase 4 logistics display change).

**Estimated completion for a V1 pilot scope: ~95%** (up from ~93%; see the per-area breakdown in §2 for how
this is derived). This round closed three of the previous Top 10's concrete gaps — API rate limiting,
structured request/error logging, and a working Sheets backup mechanism — plus fixed a real silent
auth-failure bug (a suspended or rejected sign-in bounced the user back to the logged-out screen with zero
explanation) and completed a full-backend Portuguese translation sweep that turned out to be far larger than
the single Admin-only item originally logged. The remaining gap to "unmonitored public launch" is now almost
entirely the absence of automated tests — every other concrete item from the last review has either shipped
or been explicitly re-scoped to Version 2.

---

## 2. Direct Answers to the Stakeholder's Follow-Up Questions

### Is every workflow complete?

**Donor → Institution → Admin → Success Story → Reports → Notifications:** yes, verified in one continuous
live run (disposable accounts, real photo uploads, real API calls) — donation created → accepted → collection
scheduled → collected → delivered → Success Story submitted → Admin approved the story → it appeared on both
the Donor App and the Institution's own list → Reports reflected it → notifications fired correctly at every
step with working deep-links → dashboard stats updated at each stage.

**Corporate Accounts:** yes, as its own workflow (a donor joins a company via an Admin-generated invitation
code) — verified live in the Admin Parity program, including the code's usage counter and a company-suspended
rejection path. It doesn't chain *into* the donation lifecycle above by design — a corporate donor's
donations flow through the exact same donation workflow as any other donor's, tagged by `Corporate_Account_ID`.

**Country Management:** yes, as its own supporting workflow (Admin activates/adds countries; a
country's `Active` state gates whether Donor/Institution registration and the switch-country prompt offer
it) — verified live. It's ambient context for the other workflows, not a sequential step inside them, so it
doesn't "chain" the same way donation stages do.

**One real gap found and fixed during this verification:** Admin's Donations page and the Reports Donations
export both deliberately excluded Pending (not-yet-claimed) donations — correct for the Donations page
(setting a collection estimate before a donation is claimed makes no sense) but wrong for Reports, whose job
is comprehensive visibility. Fixed today: Reports now shows every donation regardless of status.

### Is every Admin feature at parity?

**Yes, for every capability Donor or Institution actually has today** — re-confirmed directly against the
original capability list in §7. Two specific, minor gaps surfaced under closer questioning, both now tracked
in `VERSION_2_ROADMAP.md` rather than fixed silently, since neither blocks an existing workflow:
- Admin can view every donation (as of today's fix) but cannot **edit or cancel** one on a donor's behalf —
  only the donor themselves can, and only while still Pending.
- Admin's Countries page can activate/add countries but has no **per-country statistics** rollup (institution
  count, donation count per country) — `Country_ID` is present on the underlying records, but there's no
  dedicated view for it yet.

### Is there any remaining AppSheet dependency anywhere?

**No.** Checked directly: `grep`'d every app's source tree for "AppSheet" — every match is a doc comment
(explaining historical context or confirming retirement), never an import, API call, webhook, or runtime
dependency. No AppSheet package appears in any `package.json`. One stale comment was found during this check
(`requireVerified` in `apps/api/src/middleware/auth.ts` still described institution approval as "editing the
row in AppSheet") — corrected today; the underlying logic it described was already correct, only the
documentation was outdated.

### What are the Top 10 remaining issues?

Ranked by severity — see §9 for the full write-up of each:

| # | Severity | Issue |
|---|---|---|
| 1 | **High** | No automated test suite anywhere in the codebase |
| 2 | Medium | Google Sheets rate limit mitigated, not eliminated, under sustained load |
| 3 | Medium | Dependency vulnerabilities remaining after `npm audit fix` are all transitive (`firebase-admin`'s unused Cloud Storage path, Expo/xcode tooling) and need a breaking `--force` upgrade to clear |
| 4 | Low | Admin cannot edit/cancel a donor's raw donation (no support override path) |
| 5 | Low | Admin cannot suspend a verified institution after the fact (only reject before verification) |
| 6 | Low | No per-country statistics rollup for Admin |
| 7 | Low | Mobile apps not re-verified in a simulator since the latest web/API changes |
| 8 | Low | No pagination on any list endpoint; a few N+1-shaped Admin lookups |
| 9 | Low | One pre-existing orphaned `Corporate_Account_ID` data pointer on a real Donor row (cosmetic, handled gracefully) |
| 10 | Low | No real migration-history mechanism, only the narrative `PROJECT_STATUS.md` record |

*(Resolved this round — no longer open: API rate limiting, structured request/error logging, a working
Sheets backup mechanism, the silent auth-failure-messaging bug, and the full backend i18n sweep — previously
items 2, 3, and 8 on this list. Found-and-fixed in earlier reviews: Admin donation-visibility gap,
CSV/formula-injection gap, one stale AppSheet comment.)*

### What is the actual completion percentage?

Reasoned per area, not a single feeling. This round's changes were entirely production hardening and bug
fixes (no new business functionality), so the increases below are attributable to specific, concrete items
closing — not general reassessment.

| Area | Completion | Why |
|---|---|---|
| **Core Platform** | 98% | Unchanged — auth, multi-country architecture, Notification Engine remain rock solid. |
| **Donor App** | 98% | Up from 97%: the auth-failure-messaging gap that docked this is now fixed and live-verified. |
| **Institution App** | 98% | Same fix applies equally here. |
| **Admin Web App** | 95% | Up from 94%: the Admin polish pass closed the remaining UI gaps (institution logo/location/coverage now visible before approval, Countries page consistency). The donation edit/cancel and per-country-stats gaps from §2 remain, now joined by the newly-found "can't suspend a verified institution" gap — all three tracked in `VERSION_2_ROADMAP.md`, none blocking an existing workflow. |
| **Backend / API** | 97% | Up from 94%: rate limiting and structured logging — the two items that specifically docked this category — are both done and live-verified. |
| **Security** | 93% | Up from 89%: rate limiting closes the biggest gap named here. `npm audit fix` (non-breaking) applied; remaining vulnerabilities are confirmed-unreachable transitive dependencies, not code this project wrote. |
| **Production Readiness** | 90% | Up from 83% — the biggest single move, because this category's own named blockers (no rate limiting, no backup mechanism, no structured logging) are now concretely resolved. Held below Backend/Security because the one item this category cares about most — an automated test suite — still doesn't exist. |

**Unweighted average: ~95.6%** — up from ~93.1%, driven by specific closed gaps rather than a general
re-estimate. The remaining distance to 100% across every area is overwhelmingly the automated-test-suite gap,
plus the small number of deliberately-deferred V2 items.

---

## 3. Features Completed

**Donor App** (Web + iOS + Android): registration/sign-in (Email/Password, Google, Apple), profile
completion, GPS-first location capture with address/geocoding fallback (no manual Lat/Lng anywhere),
donation submission with photo upload and no artificial quantity cap, Public Donation Code, donation
timeline with date+time, Success Stories / Impact Moments tab, notifications with working deep-links,
institution browsing, corporate-account joining via invitation code, Active Country switching with a
GPS-detected switch prompt (scoped to currently-launched countries only), a developer country simulator,
and full Settings (profile, privacy/name-visibility toggle, change-request submission).

**Institution App** (Web + iOS + Android): registration with the same GPS/address flow, Admin verification
gate, full donation lifecycle (browse available → accept → schedule collection → mark collected → confirm
delivery) each step timestamped and toast-confirmed, dispute ("Ocorrência") reporting, Success Story
submission with Pending/Approved/Rejected status and rejection-reason display, profile change-request flow
with human-readable field labels (not raw Sheet column names), Home dashboard stats, notifications with
deep-linking.

**Admin Web App** (built out substantially this cycle — see §7): Dashboard with platform-wide stats,
Institution approval/rejection, Donation logistics (expected-date scheduling) plus full-visibility Reports,
Success Story moderation, Change Request moderation, Users (search/suspend/reactivate/role-change/
password-reset), Countries (activate/add), Disputes (resolve), Corporate Accounts (full CRUD + a real
invitation-code system with expiration/max-usage/single-multi-use), Notifications (manual send + scoped
broadcast + history), Reports (6 report types + CSV export, now with formula-injection protection).

**Platform-wide:** multi-country architecture (Geo_Regions hierarchy, Active/Coming-Soon distinction),
a generic Notification Engine (13+ event types, single write path, failure-tolerant), Firebase Auth identity
layer cleanly separated from the Google Sheets business-data layer, consistent shared UI component library
(`packages/ui`) and shared types/enums (`packages/shared`) used identically across all three web apps.

---

## 4. Remaining Features / Explicitly Deferred

These are not bugs — they're scope decisions already made (most now formally tracked in
`VERSION_2_ROADMAP.md` under the Feature Freeze), listed here so nothing is mistaken for an oversight:

- **Settings / Feature Flags** (Admin): nothing in the codebase reads a flag or setting today, so there's
  nothing concrete to build yet.
- **Active-Country filtering audit**: explicitly paused by the stakeholder before the stabilization phase.
- **Phase 4 — logistics display change** (stage-only display replacing the current Admin-settable Expected
  Collection/Delivery Date estimates): a genuine product decision about an *existing* feature, not a bug.
- **Reports enhancements**: charts, date-range filtering, scheduled/emailed reports.
- **Corporate Account logo upload**, **per-country statistics**, **Admin donation edit/cancel**: see §2.

---

## 5. Known Bugs

**All bugs found during this project's many live-testing rounds have been fixed and verified.** This round
found and fixed one real, previously-undetected bug: a silent auth-failure bounce. If Firebase login
succeeded but the backend rejected the session (suspended account, no matching row, Sheets briefly down), the
user was signed in at the Firebase layer yet silently landed back on the logged-out screen with zero
explanation — a race between the sign-in form's own navigation and the async listener that would have caught
the failure. Reproduced live with a disposable suspended account before fixing; fixed in all three web apps
by making `AuthContext.signIn()` resolve the session itself and rethrow on failure, so the form's own catch
block reacts before ever navigating away. Verified live: the suspended-account message now renders directly
on the sign-in form.

Also found and fixed during previous rounds: the Admin donation-visibility gap, the CSV/formula-injection gap
in Reports, and one stale AppSheet-referencing comment. The full historical list is the accumulated
`PROJECT_STATUS.md` record.

**Currently open, not fixed (deliberately, with reasoning given each time):**
- One pre-existing orphaned data reference: a real Donor's `Corporate_Account_ID` points at a
  `Corporate_Accounts` row that no longer exists. Predates this project's recent work; low real-world impact
  (`getCorporateAccountById` already returns `null` gracefully wherever this is read); worth a one-off data
  cleanup at some point, not urgent.

---

## 6. UX Improvements Worth Considering (not blocking)

- **Reports**: no date-range or status filtering within a report type yet.
- **Corporate Accounts**: no logo upload — cosmetic only.
- **Mobile parity checkpoint**: the GPS/address and quantity changes were applied to mobile using the
  identical pattern already verified on web, and both mobile workspaces typecheck clean, but were **not**
  re-run in an iOS/Android simulator since (the earlier, separate Android verification pass predates these
  specific changes). Recommend one simulator pass before a pilot that includes mobile users.

---

## 7. Security Review

Checked directly against the current codebase, not from memory:

- **Secrets hygiene: clean.** `.env`/`.env.local` are gitignored; only `.env.example` (no real values) is
  tracked. No hardcoded credentials found anywhere in `apps/api/src`.
- **Auth architecture: sound.** Firebase Auth is identity-only; it never touches business data. Every
  protected route re-verifies the Firebase ID token *and* re-fetches the caller's `Users` row fresh from
  Sheets on every single request (`requireAuth`) — role/verification/suspension state can never go stale
  from a cached session. Role checks (`requireRole('Admin')`) are present on every one of the 32 Admin routes
  — checked directly (`grep`), not assumed.
- **Suspension takes effect immediately**: both `requireAuth` and the login endpoint itself
  (`/auth/session`) check `Status === 'Suspended'` before proceeding. Privilege-escalation guard: Admin's own
  "change a user's role" action is hard-restricted in the service layer to Donor↔Institution — no path,
  including through the Admin UI, grants Admin access to an arbitrary account.
- **XSS: no direct risk found.** `grep`'d for `dangerouslySetInnerHTML` across all three web apps — zero
  matches. All user-entered text is rendered through normal JSX, which auto-escapes.
- **CSV/formula injection: found and fixed** in the Admin Reports export.
- **File uploads:** size-capped at 8MB and MIME-type-filtered to `image/*` on every upload route — checked
  directly in the multer configs.
- **API-level rate limiting: now in place.** Three tiers via `express-rate-limit`
  (`apps/api/src/middleware/rate-limit.ts`): a generous global limiter on every route, a tighter limiter on
  `/auth/session`, and a dedicated one on `/geo-regions/geocode` specifically because that route proxies the
  free OpenStreetMap Nominatim service, whose own usage policy is the thing actually at risk from an abusive
  client. Live stress-tested earlier at up to 250 concurrent requests with graceful, friendly failure — not
  raw errors — once a limit is hit.
- **Structured logging: now in place.** Every request emits one JSON line (method/path/status/duration/
  userId/role, no bodies) and unhandled errors log the same structured shape plus a stack trace — previously
  the only visibility into what happened in production was whatever a developer happened to be watching.
- **Dependency vulnerabilities:** `npm audit fix` (non-breaking) applied across the monorepo. What remains is
  entirely transitive: `firebase-admin`'s dependency on `@google-cloud/storage` (confirmed via `grep` that
  this app never imports Cloud Storage directly — Firebase Auth only) and the Expo/xcode mobile build
  toolchain. Clearing these fully requires a breaking `--force` upgrade of `firebase-admin` and/or Expo,
  which risks breaking auth or mobile builds — not attempted without explicit stakeholder sign-off given the
  Feature Freeze's "no unnecessary architecture changes" instruction.

---

## 8. Performance, Database & Scalability

- **No pagination anywhere.** Every "list" function reads an entire Sheet tab on every call — fine at
  current volume, will slow linearly as data grows.
- **A few N+1-shaped lookups** in Admin aggregation functions (change requests, disputes, corporate
  accounts) — fine at today's scale, would need batching at hundreds of rows.
- **Google Sheets rate limit — mitigated, not eliminated.** Retry-with-backoff absorbs the overwhelming
  majority of realistic bursts (100% success burst-tested at 80 concurrent requests), but the underlying
  per-minute quota is still a real ceiling under sustained (not just bursty) load. No caching layer exists.
- **No CDN/caching for photos** — served directly from Google Drive thumbnail URLs. Fine for a pilot.
- **Schema hygiene:** 10 Sheet tabs, additive-only migrations via one-off scripts (written, run once,
  deleted) — safe so far, but with **no persistent migration-history file**, only the narrative record in
  `PROJECT_STATUS.md`.
- **Backup mechanism: now in place.** `apps/api/scripts/backup-sheets.ts` (`npm run backup
  --workspace=apps/api`) exports every tab to timestamped JSON, tolerating a single tab's failure without
  aborting the rest. Live-run against production: all 10 tabs backed up successfully. Wiring this into a
  recurring schedule against persistent storage is a deployment-host decision, not something this script
  decides — most PaaS hosts have ephemeral local disks, so a local-only backup is only as durable as the next
  deploy.
- **Google Sheets' hard platform limits** (~10M cells, the per-minute quota) are nowhere close to a concern
  at pilot volume, and are an already-documented (`DEVELOPMENT_RULES.md` §13) future migration path beyond
  it — not new information, restated here as part of a launch decision.
- **Single shared spreadsheet = single point of contention** across all five client apps; no sharding or
  read-replica concept is possible with this architecture.

---

## 9. Technical Debt

- **Zero automated tests.** Checked directly: no `.test.ts`/`.spec.ts` files anywhere, no `test` script in
  any `package.json`. Every verification this project has done is manual, live QA — thorough and
  well-documented (most recently a full disposable-account E2E script covering the entire Donor → Institution
  → Admin lifecycle), but with no regression-test safety net. The single largest piece of technical debt here.
- **One-off migration scripts, not a migration framework** (§8).
- **AppSheet retirement: confirmed complete** — see §2. No functional dependency remains anywhere; the one
  stale doc comment found was corrected today.

---

## 10. Admin Web App Parity — Confirmed

Cross-checked against the stakeholder's original capability list:

| Area | Status |
|---|---|
| Dashboard | Complete |
| Users | Complete — view/search/suspend/reactivate/role/reset |
| Institutions | Complete — approve/reject/view (now including logo/location/coverage before deciding)/profile-change moderation; suspending an already-verified institution is a tracked V2 gap |
| Donations | Complete — view **every** donation (including Pending)/search/status/logistics scheduling; edit/cancel is a tracked V2 gap, not a workflow blocker |
| Success Stories | Complete — approve/reject, nothing publishes without approval |
| Corporate Accounts | Complete — CRUD + real invitation codes + employee/donation counts |
| Countries | Complete for activate/add; per-country statistics rollup is a tracked V2 gap |
| Disputes | Complete — dedicated moderation page (resolve) |
| Notifications | Complete — manual send + scoped broadcast + history |
| Reports | Complete — 6 types + CSV export |
| Settings | Deliberately deferred — nothing to control yet |

**Admin is at genuine functional parity with Donor and Institution for every capability that currently
exists in those two apps.** The two minor gaps found under closer questioning (donation edit/cancel,
per-country stats) don't block any existing workflow and are now tracked in `VERSION_2_ROADMAP.md`.

---

## 11. Recommended Launch Checklist

**Before any pilot:**
- [x] ~~Confirm backup/restore expectations~~ — a working backup script exists and was live-run against
      production; wiring it to a recurring schedule still needs a chosen deployment host.
- [ ] Decide and execute Portugal (or any other country) `Active` flag flip, if the pilot includes it —
      currently only Angola is launched.
- [ ] One iOS/Android simulator pass confirming the GPS/address/quantity changes on mobile.
- [x] ~~`npm audit fix` (non-breaking)~~ — applied; remaining findings are confirmed-unreachable transitive
      dependencies (see §7).

**Before a public (non-pilot) launch:**
- [x] ~~Basic API rate limiting~~ — three-tier `express-rate-limit` in place globally, on auth, and on the
      geocoding proxy; stress-tested up to 250 concurrent requests.
- [ ] Some form of automated test coverage for the core donation lifecycle, even a minimal smoke-test suite.
- [ ] A real migration-history mechanism, or at least a single consolidated schema-changes doc.
- [x] ~~Full backend i18n pass~~ — done; every backend-facing message across all apps is now Portuguese.
- [ ] Active-Country filtering audit (already on the roadmap, currently paused per the stakeholder).
- [ ] Phase 4 logistics-display decision (dates vs. stage-only) — a genuine product decision, not a bug fix.

---

## 12. Bottom Line

WAFINA's core product — donor donates, institution fulfills, admin oversees, impact gets told — works, has
been tested end-to-end repeatedly, and Admin has genuinely caught up to Donor/Institution. Version 1.0 is
now under Feature Freeze: the focus from here to launch is stability, reliability, security, performance, UX
polish, end-to-end validation, and production readiness — not new capability. New ideas go to
`VERSION_2_ROADMAP.md`.

This round closed out the production-hardening checklist that stood between the platform and a pilot: rate
limiting, structured logging, and a working backup mechanism are all in place and live-verified, a real
silent auth-failure bug is fixed, and the full backend is now consistently Portuguese rather than a mix of
languages. The gaps that remain are the kind every real product still has at this stage: no automated tests
(the single largest one), a Sheets rate-limit ceiling that's mitigated but not eliminated under sustained
load, and features the stakeholder has deliberately deferred rather than anything left unfinished by
accident.

**A controlled, monitored pilot is a reasonable next step. A fully public, unmonitored launch should wait for
the "before a public launch" checklist above.**
