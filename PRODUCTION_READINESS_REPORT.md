# WAFINA — Production Readiness Report

**Date:** 2026-07-31
**Prepared by:** Claude, at the stakeholder's request, following the Platform Stabilization phase and the
Google Sheets rate-limit resilience fix (see `PROJECT_STATUS.md` for full history).
**Purpose:** a single go/no-go assessment before starting any new feature module — completion status,
outstanding bugs, security/performance/database/scalability review, and a launch checklist.

This report is a snapshot assessment, not new development. Every claim below is grounded in either the actual
codebase (checked while writing this, not recalled from memory) or the accumulated `PROJECT_STATUS.md` record
of live-tested work this project. Where I'm giving a judgment call rather than a verified fact, I've said so.

---

## 1. Executive Summary

**Recommendation: ready for a controlled pilot launch (single country, small user base, active monitoring),
not yet ready for an unmonitored public launch.**

The core donor→institution→admin donation lifecycle — including multi-country architecture, Success Story
moderation, notifications, and now a genuinely full-featured Admin Web App — is functionally complete and has
been repeatedly live-tested end-to-end this session, most recently in one continuous real workflow covering
every step from donation creation through Success Story approval and cross-app propagation. The two issues
raised in the last review round (Sheets rate-limit handling, and this report itself) are now addressed.

What stands between here and an unmonitored public launch is not missing core functionality — it's the
absence of an automated test suite, a handful of real but non-blocking security/performance items (detailed
below), and features that were explicitly scoped out as "not needed yet" (Settings/feature flags) or
deliberately deferred by the stakeholder (Active-Country filtering audit, Phase 4 logistics display change).

**Estimated completion for a V1 pilot scope: ~85%.** The 15% gap is concentrated in: no automated regression
tests, a few real-but-minor security/performance hardening items, and the two explicitly-deferred phases.

---

## 2. Features Completed

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

**Admin Web App** (built out substantially this session — see Admin Parity Program below): Dashboard with
platform-wide stats, Institution approval/rejection, Donation logistics (expected-date scheduling),
Success Story moderation, Change Request moderation, Users (search/suspend/reactivate/role-change/
password-reset), Countries (activate/add), Disputes (resolve), Corporate Accounts (full CRUD + a real
invitation-code system with expiration/max-usage/single-multi-use), Notifications (manual send + scoped
broadcast + history), Reports (6 report types + CSV export, now with formula-injection protection).

**Platform-wide:** multi-country architecture (Geo_Regions hierarchy, Active/Coming-Soon distinction),
a generic Notification Engine (13+ event types, single write path, failure-tolerant), Firebase Auth identity
layer cleanly separated from the Google Sheets business-data layer, consistent shared UI component library
(`packages/ui`) and shared types/enums (`packages/shared`) used identically across all three web apps.

---

## 3. Remaining Features / Explicitly Deferred

These are not bugs — they're scope decisions already made, listed here so nothing is mistaken for an
oversight:

- **Settings / Feature Flags** (Admin): deferred by the stakeholder's own choice during the Admin Parity
  program — nothing in the codebase reads a flag or setting today, so there's nothing concrete to build yet.
- **Active-Country filtering audit**: explicitly paused by the stakeholder before this stabilization phase.
  Not started.
- **Phase 4 — logistics display change** ("Collection Scheduled / In Transit / Delivered" without promised
  dates, replacing the current Admin-settable Expected Collection/Delivery Date estimates): explicitly
  "later" per the stakeholder's own ordering. Flagged directly to the stakeholder that this would be a
  product change to an *existing* feature (built in Module 6), not implementing something skipped.
- **Reports**: a first pass (table + CSV). No charting/visualization, no scheduled/emailed reports, no
  date-range filtering yet — reasonable for a pilot, worth revisiting post-launch if Admin needs more.
- **Corporate Accounts**: no logo upload UI yet (the `Logo` field exists and displays, but nothing sets it
  except direct Sheet edit) — matches the original spec's own note that this was intentionally out of scope
  until Corporate Accounts had any real self-service surface at all.

---

## 4. Known Bugs

**All bugs found during this project's many live-testing rounds have been fixed and verified.** The
consolidated list of everything found and resolved is the accumulated `PROJECT_STATUS.md` record (leaked
`Needs_List` field name, donation quantity cap, manual Lat/Lng requirement, Success Story auto-publish,
timeline missing time-of-day, hydration bug in the Photo component, notification-failure false negatives,
an invitation-code ordering bug that could let a rejected join silently consume a limited-use code, the
Google Sheets rate-limit surfacing as a raw error, and the CSV-injection gap fixed today).

**Currently open, not fixed (deliberately, with reasoning given each time):**
- One pre-existing orphaned data reference: a real Donor's `Corporate_Account_ID` points at a
  `Corporate_Accounts` row that no longer exists. Predates this session's work; low real-world impact
  (`getCorporateAccountById` already returns `null` gracefully wherever this is read); worth a one-off data
  cleanup at some point, not urgent.
- English-language `ValidationError` messages on Admin-only actions (e.g. "Country not found", "Only a
  Pending request can be approved") — inconsistent with `DEVELOPMENT_RULES.md` §9 ("Portuguese complete for
  launch"), but Admin-only, not donor/institution-facing. The four messages a real *donor* could actually
  trigger (invitation-code join failures) were translated when found; a full backend i18n pass for every
  Admin-only message is separate, deferred work — not blocking for a pilot where the Admin operators are the
  same people who commissioned this in Portuguese-fluent Angola/Portugal contexts anyway.

---

## 5. UX Improvements Worth Considering (not blocking)

- **Auth failure messaging**: every app's `AuthContext` collapses any `/auth/session` failure (suspended
  account, no account yet, invalid token, rate-limited) to the same "redirect to sign-in, no message"
  behavior. A user whose account gets suspended sees no explanation — just a bounce back to the sign-in
  screen. Worth a small, contained fix: surface *why* sign-in failed.
- **Reports**: no date-range or status filtering within a report type yet — for a pilot with modest data
  volume this is fine; will matter more as data grows.
- **Corporate Accounts**: no logo upload (see above) — cosmetic only.
- **Mobile parity checkpoint**: the GPS/address and quantity changes from this session's stabilization module
  were applied to the mobile apps using the identical pattern already verified on web, and both mobile
  workspaces typecheck clean, but were **not** re-run in an iOS/Android simulator this session (the earlier,
  separate Android verification pass predates these specific changes). Recommend one simulator pass before
  a pilot that includes mobile users.

---

## 6. Security Review

Checked directly against the current codebase, not from memory:

- **Secrets hygiene: clean.** `.env`/`.env.local` are gitignored; only `.env.example` (no real values) is
  tracked. No hardcoded credentials found anywhere in `apps/api/src`.
- **Auth architecture: sound.** Firebase Auth is identity-only; it never touches business data. Every
  protected route re-verifies the Firebase ID token *and* re-fetches the caller's `Users` row fresh from
  Sheets on every single request (`requireAuth`) — role/verification/suspension state can never go stale
  from a cached session. Role checks (`requireRole('Admin')`) are present on every one of the 32 Admin routes
  — checked directly (`grep`), not assumed.
- **Suspension takes effect immediately** (built this session): both `requireAuth` and the login endpoint
  itself (`/auth/session`) check `Status === 'Suspended'` before proceeding, so a suspended account can't
  keep using an already-issued token, and can't even get a fresh session.
  Privilege-escalation guard: Admin's own "change a user's role" action is hard-restricted in the service
  layer to Donor↔Institution — there is no path, including through the Admin UI, to grant Admin access to an
  arbitrary account.
- **XSS: no direct risk found.** `grep`'d for `dangerouslySetInnerHTML` across all three web apps — zero
  matches. All user-entered text is rendered through normal JSX, which auto-escapes.
- **CSV/formula injection: found and fixed today** (see §4) in the new Admin Reports export.
- **File uploads:** size-capped at 8MB and MIME-type-filtered to `image/*` on every upload route (donations,
  success stories, institution logos) — checked directly in the multer configs.
- **No API-level rate limiting.** No `express-rate-limit` or equivalent anywhere in `apps/api`. Firebase's
  own sign-in flow has its own abuse protection (sign-in itself happens client-side against Firebase, not
  through this API), but nothing throttles repeated calls to this API's own endpoints — e.g. the geocoding
  proxy (`/geo-regions/geocode`, which calls the free OpenStreetMap Nominatim service) has no per-user
  throttle, and an abusive client could drive enough traffic to get the app's shared IP rate-limited or
  banned by Nominatim's usage policy. **Recommend adding basic rate limiting before a public (non-pilot)
  launch** — not urgent for a small, known pilot user base.
- **Dependency vulnerabilities:** `npm audit` across the monorepo reports 25 (15 moderate, 10 high),
  concentrated in transitive dependencies of `firebase-admin` (`google-cloud/storage`, `teeny-request`,
  `retry-request`, `uuid`) and Expo build tooling (`@expo/config-plugins` and friends) — none in code this
  project wrote directly, and none obviously reachable by attacker-controlled input in how this app actually
  uses those libraries. Recommend running `npm audit fix` (non-breaking) and re-assessing the rest
  periodically; not a launch blocker for a pilot.

---

## 7. Performance Review

- **No pagination anywhere.** Every "list" function (`getRows`) reads an entire Sheet tab on every call —
  fine at current data volume (dozens of rows per tab), but every list will get linearly slower as data
  grows, with no cutoff built in.
- **N+1-shaped lookups in a few Admin aggregation functions**, all written this session: change-request and
  dispute moderation queues each do one institution lookup per pending item; `listAllCorporateAccounts` does
  one employee-count lookup per company. Fine at today's scale (a handful of institutions/companies); would
  need batching if either list grows into the hundreds.
- **Google Sheets rate limit — now mitigated, not eliminated.** The retry-with-backoff fix (today) absorbs
  the overwhelming majority of realistic bursts (burst-tested to 100% success at 80 concurrent requests), but
  the underlying per-minute quota is still a real ceiling — a genuinely high-traffic pilot could still hit it
  under sustained (not just bursty) load. No caching layer exists in front of Sheets.
- **No CDN/caching for photos** — every photo is served directly from its Google Drive thumbnail URL. Fine
  for a pilot; would want a real CDN or image-optimization layer at meaningful scale.

---

## 8. Database Review

- **Google Sheets as the production database is a deliberate, documented V1 decision** (`DEVELOPMENT_RULES.md`
  §1), not an oversight — this report doesn't relitigate it, only notes what it implies operationally.
- **Schema hygiene:** 10 Sheet tabs now (`Users`, `Donations`, `Institutions`, `Disputes`,
  `Corporate_Accounts`, `Change_Requests`, `Notifications`, `Geo_Regions`, `Success_Stories`,
  `Invitation_Codes`). Every column addition this project has followed the same additive-only,
  backfill-then-verify migration pattern via one-off scripts (written, run once, deleted) — there is **no
  persistent migration history file**, only the narrative record in `PROJECT_STATUS.md`. This is a real,
  known trade-off of the Sheets-as-DB approach: safe so far because every migration has been small and
  carefully verified, but there's no automated way to reconstruct "what changed the schema and when" other
  than reading `PROJECT_STATUS.md` top to bottom.
- **One known orphaned reference** (see §4) — real, low-impact, not urgent.
- **No formal backup/restore process observed or documented** beyond Google Sheets' own native version
  history. Worth explicitly confirming with the stakeholder what the backup expectation is before a pilot
  with real user data.

---

## 9. Scalability Concerns

- **Google Sheets has hard platform limits**: roughly 10 million cells per spreadsheet, and the per-minute
  read/write quota discussed above. At a small pilot's volume (dozens to low hundreds of donations/users) this
  is nowhere close to a concern. It **is** a real, architecturally-known ceiling for anything beyond a pilot —
  already flagged as a future migration path in `DEVELOPMENT_RULES.md` §13, not new information, just worth
  restating here as part of a launch decision.
- **Single shared spreadsheet = single point of contention** across all three web apps and both mobile apps.
  There's no sharding or read-replica concept possible with this architecture.

---

## 10. Technical Debt

- **Zero automated tests.** Checked directly: no `.test.ts`/`.spec.ts` files anywhere in the repository, no
  `test` script in any `package.json`. Every one of this project's many verification passes has been live,
  manual QA — thorough and well-documented, but with no regression-test safety net. This is the single
  largest piece of technical debt in the project: any future change could silently break something already
  verified, and the only way to catch it is another full manual pass.
- **English error-message inconsistency** (see §4) on Admin-only validation errors.
- **One-off migration scripts, not a migration framework** (see §8) — works, but doesn't scale as a practice
  much beyond where the project already is.
- **AppSheet retirement:** confirmed no new AppSheet-dependent logic has been added since the 2026-07-30
  policy change; the phrase "exclusively in AppSheet" was found and replaced everywhere it was stale
  documentation (Change Requests, Corporate Accounts, Disputes) as part of the Admin Parity program.

---

## 11. Admin Web App Parity — Confirmed

Cross-checked against the stakeholder's original capability list (Dashboard, Users, Institutions, Donations,
Success Stories, Corporate Accounts, Countries, Notifications, Reports, Settings):

| Area | Status |
|---|---|
| Dashboard | ✅ Complete |
| Users | ✅ Complete (view/search/suspend/reactivate/role/reset) |
| Institutions | ✅ Complete (approve/reject/view/profile-change moderation) |
| Donations | ✅ Complete (view/search/status/logistics scheduling) — no dispute-resolution *from this list*, but disputes have their own dedicated Admin page |
| Success Stories | ✅ Complete (approve/reject, nothing publishes without approval) |
| Corporate Accounts | ✅ Complete (CRUD + real invitation codes + employee/donation counts) |
| Countries | ✅ Complete (activate/add) |
| Notifications | ✅ Complete (manual send + scoped broadcast + history) |
| Reports | ✅ Complete (6 types + CSV export) |
| Settings | ⏸️ Deferred (nothing to control yet — stakeholder's own call) |

**Admin is at genuine functional parity with Donor and Institution for every capability that currently exists
in those two apps.** The one item not built (Settings) has no concrete need behind it yet, by design.

---

## 12. Risks Before Launch

Ranked by severity:

1. **No automated tests** — highest-impact technical debt; every future change is a manual-QA-or-nothing bet.
2. **No backup/restore process confirmed** — real user data risk if this hasn't been discussed with the
   stakeholder yet.
3. **Sheets rate limit / scalability ceiling** — mitigated today, not eliminated; fine for a pilot, a real
   constraint beyond it.
4. **No API rate limiting** — low risk for a small known pilot user base, real risk if the URL becomes public
   before a proper launch.
5. **Dependency vulnerabilities** — moderate/high severity, but transitive and not obviously exploitable
   through this app's actual usage; still worth a housekeeping pass.
6. **Mobile apps not re-verified in a simulator** since the latest stabilization changes — low risk (same
   code pattern already verified on web) but unconfirmed.
7. **Orphaned Corporate_Account_ID reference** — cosmetic/low-impact.

None of these are "the app doesn't work" risks — every one is a hardening/completeness gap on top of a
functioning, live-tested product.

---

## 13. Recommended Launch Checklist

**Before any pilot:**
- [ ] Confirm backup/restore expectations for the Google Sheets data with the stakeholder.
- [ ] Decide and execute Portugal (or any other country) `Active` flag flip, if the pilot includes it —
      currently only Angola is launched.
- [ ] One iOS/Android simulator pass confirming the GPS/address/quantity changes on mobile.
- [ ] `npm audit fix` (non-breaking) across the monorepo; re-assess remaining findings.

**Before a public (non-pilot) launch:**
- [ ] Basic API rate limiting (at minimum on `/auth/session` and `/geo-regions/geocode`).
- [ ] Some form of automated test coverage for the core donation lifecycle, even a minimal smoke-test suite.
- [ ] A real migration-history mechanism, or at least a single consolidated schema-changes doc, rather than
      relying on reading `PROJECT_STATUS.md` narratively.
- [ ] Full backend i18n pass on the remaining English Admin-only error messages.
- [ ] Active-Country filtering audit (already on the roadmap, currently paused per the stakeholder).
- [ ] Phase 4 logistics-display decision (dates vs. stage-only) — a genuine product decision, not a bug fix.

---

## 14. Bottom Line

WAFINA's core product — donor donates, institution fulfills, admin oversees, impact gets told — works, has
been tested end-to-end repeatedly (most recently in one continuous live run through the entire lifecycle),
and Admin has genuinely caught up to Donor/Institution. The gaps that remain are the kind every real product
has at this stage: no automated tests, a rate-limit ceiling that's mitigated but not eliminated, a few
security-hardening items appropriate for scaling past a pilot, and two features the stakeholder has
deliberately deferred rather than anything left unfinished by accident.

**A controlled, monitored pilot is a reasonable next step. A fully public, unmonitored launch should wait for
the "before a public launch" checklist above.**
