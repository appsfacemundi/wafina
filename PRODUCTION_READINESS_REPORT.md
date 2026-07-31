# WAFINA — Production Readiness Report

**Date:** 2026-07-31 (updated same day with direct answers to the stakeholder's follow-up review)
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

**Estimated completion for a V1 pilot scope: ~91%** (see the per-area breakdown in §2 for how this is
derived — not a single feeling, but seven separately-reasoned figures). One real gap was found and fixed
while re-verifying this report (Admin had no visibility into a donation before it was claimed — see §3);
that a second, deliberately skeptical pass still turned up something real is itself part of why the
percentages below aren't higher.

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
| 2 | Medium | No API-level rate limiting (auth, geocoding proxy exposed) |
| 3 | Medium | No confirmed backup/restore process for the Sheets database |
| 4 | Medium | Google Sheets rate limit mitigated, not eliminated, under sustained load |
| 5 | Medium | 25 dependency vulnerabilities (15 moderate, 10 high), transitive |
| 6 | Low | Admin cannot edit/cancel a donor's raw donation (no support override path) |
| 7 | Low | No per-country statistics rollup for Admin |
| 8 | Low | A handful of Admin-only backend error messages remain in English |
| 9 | Low | Mobile apps not re-verified in a simulator since the latest changes |
| 10 | Low | No pagination on any list endpoint; a few N+1-shaped Admin lookups |

*(Found-and-fixed during this review — not carried forward as open issues: Admin donation-visibility gap,
CSV/formula-injection gap, one stale AppSheet comment, one orphaned `Corporate_Account_ID` reference remains
open but is cosmetic-only and listed in §4, not in this top 10.)*

### What is the actual completion percentage?

Reasoned per area, not a single feeling:

| Area | Completion | Why |
|---|---|---|
| **Core Platform** | 97% | Auth, multi-country architecture, Notification Engine — rock solid, repeatedly live-tested. Docked only for the paused Active-Country audit and no per-country stats. |
| **Donor App** | 96% | Every workflow built and live-verified this cycle. Docked for the generic auth-failure-messaging gap (§5). |
| **Institution App** | 96% | Same standard as Donor; same minor auth-messaging gap. |
| **Admin Web App** | 92% | Comprehensive 3-phase parity build-out, now genuinely complete for every existing Donor/Institution capability. Docked for the two minor gaps in §2 and Settings being deliberately unbuilt. |
| **Backend / API** | 93% | Solid architecture; retry/backoff added this cycle. Docked for no rate limiting and no automated tests. |
| **Security** | 87% | Strong fundamentals — verified auth, RBAC, suspension, no XSS, CSV-injection fixed. Docked for no rate limiting and unpatched (if low-risk) dependency vulnerabilities. |
| **Production Readiness** | 82% | The deliberately hardest-nosed category: no tests, no confirmed backups, no rate limiting, narrative-only migration history. This is what "not yet ready for unmonitored public launch" is made of. |

**Unweighted average: ~91.9%**, independently arrived at from the reasoning above — landing in the same range
as the stakeholder's own separate 90–93% estimate, which is a useful cross-check rather than a coincidence:
both assessments are looking at the same underlying, well-documented body of work.

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

**All bugs found during this project's many live-testing rounds have been fixed and verified**, including,
found during this specific review round: the Admin donation-visibility gap (§2/§3), the CSV/formula-injection
gap in Reports, and one stale AppSheet-referencing comment. The full historical list is the accumulated
`PROJECT_STATUS.md` record.

**Currently open, not fixed (deliberately, with reasoning given each time):**
- One pre-existing orphaned data reference: a real Donor's `Corporate_Account_ID` points at a
  `Corporate_Accounts` row that no longer exists. Predates this project's recent work; low real-world impact
  (`getCorporateAccountById` already returns `null` gracefully wherever this is read); worth a one-off data
  cleanup at some point, not urgent.
- English-language `ValidationError` messages on Admin-only actions — inconsistent with
  `DEVELOPMENT_RULES.md` §9 ("Portuguese complete for launch"), but Admin-only, not donor/institution-facing.
  The messages a real *donor* could actually trigger (invitation-code join failures) were translated when
  found; a full backend i18n pass for every Admin-only message is separate, deferred work.

---

## 6. UX Improvements Worth Considering (not blocking)

- **Auth failure messaging**: every app's `AuthContext` collapses any `/auth/session` failure (suspended
  account, no account yet, invalid token, rate-limited) to the same "redirect to sign-in, no message"
  behavior. Worth a small, contained fix: surface *why* sign-in failed.
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
- **No API-level rate limiting.** No `express-rate-limit` or equivalent anywhere in `apps/api`. The
  geocoding proxy (`/geo-regions/geocode`, which calls the free OpenStreetMap Nominatim service) has no
  per-user throttle — an abusive client could drive enough traffic to get the app's shared IP banned by
  Nominatim's usage policy. Recommend basic rate limiting before a public (non-pilot) launch.
- **Dependency vulnerabilities:** `npm audit` across the monorepo reports 25 (15 moderate, 10 high),
  concentrated in transitive dependencies of `firebase-admin` and Expo build tooling — none in code this
  project wrote directly, none obviously reachable by attacker-controlled input in how this app uses those
  libraries. Recommend `npm audit fix` (non-breaking) and periodic re-assessment.

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
- **No formal backup/restore process** observed or documented beyond Google Sheets' own native version
  history — worth explicitly confirming the expectation with the stakeholder.
- **Google Sheets' hard platform limits** (~10M cells, the per-minute quota) are nowhere close to a concern
  at pilot volume, and are an already-documented (`DEVELOPMENT_RULES.md` §13) future migration path beyond
  it — not new information, restated here as part of a launch decision.
- **Single shared spreadsheet = single point of contention** across all five client apps; no sharding or
  read-replica concept is possible with this architecture.

---

## 9. Technical Debt

- **Zero automated tests.** Checked directly: no `.test.ts`/`.spec.ts` files anywhere, no `test` script in
  any `package.json`. Every verification this project has done is manual, live QA — thorough and
  well-documented, but with no regression-test safety net. The single largest piece of technical debt here.
- **English error-message inconsistency** on Admin-only validation errors (§5).
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
| Institutions | Complete — approve/reject/view/profile-change moderation |
| Donations | Complete — view **every** donation (including Pending, fixed today)/search/status/logistics scheduling; edit/cancel is a tracked V2 gap, not a workflow blocker |
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
- [ ] Confirm backup/restore expectations for the Google Sheets data with the stakeholder.
- [ ] Decide and execute Portugal (or any other country) `Active` flag flip, if the pilot includes it —
      currently only Angola is launched.
- [ ] One iOS/Android simulator pass confirming the GPS/address/quantity changes on mobile.
- [ ] `npm audit fix` (non-breaking) across the monorepo; re-assess remaining findings.

**Before a public (non-pilot) launch:**
- [ ] Basic API rate limiting (at minimum on `/auth/session` and `/geo-regions/geocode`).
- [ ] Some form of automated test coverage for the core donation lifecycle, even a minimal smoke-test suite.
- [ ] A real migration-history mechanism, or at least a single consolidated schema-changes doc.
- [ ] Full backend i18n pass on the remaining English Admin-only error messages.
- [ ] Active-Country filtering audit (already on the roadmap, currently paused per the stakeholder).
- [ ] Phase 4 logistics-display decision (dates vs. stage-only) — a genuine product decision, not a bug fix.

---

## 12. Bottom Line

WAFINA's core product — donor donates, institution fulfills, admin oversees, impact gets told — works, has
been tested end-to-end repeatedly, and Admin has genuinely caught up to Donor/Institution. Version 1.0 is
now under Feature Freeze: the focus from here to launch is stability, reliability, security, performance, UX
polish, end-to-end validation, and production readiness — not new capability. New ideas go to
`VERSION_2_ROADMAP.md`.

The gaps that remain are the kind every real product has at this stage: no automated tests, a rate-limit
ceiling that's mitigated but not eliminated, a few security-hardening items appropriate for scaling past a
pilot, and features the stakeholder has deliberately deferred rather than anything left unfinished by
accident.

**A controlled, monitored pilot is a reasonable next step. A fully public, unmonitored launch should wait for
the "before a public launch" checklist above.**
