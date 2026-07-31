# WAFINA — DEVELOPMENT RULES

These rules govern how `MASTER_SPECIFICATION.md` is implemented. They apply to every module, for the life of Version 1. Confirmed by stakeholder 2026-07-27.

---

## 1. Database

Google Sheets ("Wafina Database") is the **single, primary production database** for Version 1. Do not migrate to PostgreSQL, MySQL, Supabase, or any other database. Do not stand up a second data store of any kind (no cache-as-source-of-truth, no shadow DB). Both AppSheet Admin and the new production apps read and write the **same** Google Sheets file.

## 2. Synchronization

There is no sync/replication layer in Version 1, because there is only one database. The REST API reads and writes Google Sheets directly. Admin (AppSheet) reads and writes the same Sheets directly. Changes from either side are immediately visible to the other — no migration pipeline, no queue-based replication between two systems.

## 3. AppSheet / Admin

**Superseded 2026-07-30 — see §14 "Permanent Rules Update" below.** AppSheet is no longer part of WAFINA's
long-term architecture. This section is kept for history: it originally read "AppSheet Admin is permanent.
Never rebuild it, never redesign its workflows. It is the reference implementation for business logic."
Existing AppSheet-based Admin workflows (institution verification, dispute resolution, change-request
approval) keep working exactly as today — nothing is being ripped out — but no *new* AppSheet logic, Bots,
automations, workflows, or dependencies get added from this date forward. New Admin-facing capability is
designed for the future custom Admin Web Application instead. Where an AppSheet reference is encountered in
new work, replace it with a Google Sheets/Admin Web App approach whenever appropriate.

## 4. File storage

Continue using Google Drive for file storage (Photo, Logo) exactly as AppSheet does today, with file references stored in Google Sheets. Do not introduce a separate object storage service in Version 1.

## 5. API

REST only. No GraphQL. Keep endpoints simple, resource-oriented, and easy to maintain. The API is the only component that talks to Google Sheets/Drive — clients never call Google APIs directly.

## 6. Authentication

Support Email/Password, Google Sign-In, and Apple Sign-In (required for iOS compliance). Choose the simplest reliable implementation available rather than building auth from scratch.

**Confirmed architecture (2026-07-27):** Admin stays on AppSheet, unchanged and never rebuilt. Donor and Institution become custom Web/Android/iOS apps — that has been the goal since the original brief. Those custom apps cannot use AppSheet's own sign-in (AppSheet has no external-facing identity API — confirmed against current AppSheet documentation), so Firebase Authentication verifies identity for them. Firebase's role is strictly identity — it never stores or touches donation/institution business data, which remains entirely in Google Sheets, read and written only by the REST API.

## 7. Hosting

Do not optimize infrastructure prematurely. Prefer the simplest hosting option that won't need to be re-architected for reasonable early growth. Avoid multi-cloud complexity or infrastructure the team would need to operate manually.

## 8. Master Specification

`MASTER_SPECIFICATION.md` is the permanent single source of truth for business logic, roles, permissions, validation rules, and workflows. Never change business logic, remove features, simplify workflows, or redesign business processes without explicit stakeholder approval.

## 9. Language

Version 1 ships in Portuguese. All user-facing strings must be externalized (i18n-ready) from day one so additional languages can be added later without rework — but only Portuguese needs to be complete for launch.

## 10. Development philosophy

Build for a successful first launch, not for millions of users. Every decision should prioritize, in this order: simplicity, maintainability, compatibility with AppSheet, compatibility with Google Sheets, fast development, reliability. Only introduce a new technology when there is a clear, current business need — not for hypothetical future scale.

## 11. UI/UX

This is the primary goal of the rebuild. Business logic is already validated by AppSheet — do not copy AppSheet's visual design. Build a premium, modern, intuitive interface while preserving every workflow, permission, validation, and business rule exactly as documented.

## 12. Development process

One module at a time, no exceptions — the whole app is never built ahead of testing. For every module, in order:

1. **Explain** exactly what will be built.
2. **List every file** that will be created or modified.
3. **Implement** only that module — nothing from later modules.
4. **Verify**: business logic, validation, error handling, security, Google Sheets compatibility, AppSheet compatibility, mobile responsiveness, web responsiveness.
5. **Connect** the module to the real Google Sheets database whenever the module's function requires it — not deferred to "later."
6. **Provide test instructions** so the stakeholder can personally test the module on: Web browser, Android device, iPhone.
7. **Wait for explicit approval** — do not start the next module until the stakeholder has personally tested the current one and confirmed it works. If changes are requested, fix them before moving on.

For every module, report: what was built, what was tested, what still needs testing, known limitations, and recommended improvements.

Step 5 has a hard prerequisite: real Firebase project credentials and a real Google Sheets service account. Any module built before those exist can only be verified structurally (typecheck/lint/build, and graceful-degradation behavior when unconfigured) — never "fully functional" per Step 6. Flag this gap explicitly rather than presenting structural verification as if it met the Step 4/6 bar.

## 13. Future database migration

A migration to PostgreSQL or another relational database may happen after Version 1 launches successfully. Do not design Version 1 around that future migration — no premature abstraction layers or ORM-agnostic tricks solely to ease a later move. Focus entirely on shipping a stable product on Google Sheets.

---

## Standing rules from the original engagement

- Never change business logic unless explicitly requested.
- Never simplify workflows or remove features.
- Never redesign business processes.
- If something is unclear, ask before implementing.
- Preserve compatibility with the current AppSheet implementation at all times (see §14 — AppSheet itself
  is being phased out of new development, but existing behavior stays compatible until replaced).

---

## 14. Permanent Rules Update (stakeholder instruction, 2026-07-30)

Issued as a standing policy covering every remaining module. Supersedes §3 above where the two conflict.

**Architecture:** AppSheet is no longer part of WAFINA's long-term architecture. No new AppSheet logic,
Bots, automations, workflows, APIs, or dependencies. Google Sheets remains the current production database.
All new development is designed for the future custom Admin Web Application. Every architectural decision
must naturally support the future PostgreSQL migration without redesigning the application.

**Module completion rule — a module is not complete until:**
1. The API is started.
2. Every affected application is started: Web Donor, Web Institution, Donor Mobile, Institution Mobile,
   Admin (when applicable).
3. Complete end-to-end manual functional testing of every feature in that module is performed against the
   running apps.
4. Every issue found during that testing is fixed.
5. Typecheck passes.
6. Lint passes.
7. `PROJECT_STATUS.md` is updated.
8. The module is committed.
9. Work stops for the stakeholder's own verification before the next module starts.

Code review, typecheck, and lint alone are never sufficient — every module needs live manual verification.

**Keep the applications running:** after completing and testing a module, leave the API, web apps, and
mobile simulator running for the stakeholder's own immediate testing. Only stop servers if explicitly asked.

**Scope discipline:** do not expand the current module's scope. Unrelated bugs/improvements/ideas discovered
along the way get recorded under a Known Issues / Deferred Items section in `PROJECT_STATUS.md`, not
implemented immediately — only on later explicit approval. (Bugs that block the current module's own
feature from working are part of that module, not "unrelated," and get fixed as part of it.)

**Documentation:** `PROJECT_STATUS.md` stays the single source of truth. Every completed module's entry
includes: what was implemented, architectural decisions made, database/schema changes, files modified,
testing performed, remaining work, Known Issues / Deferred Items, and the git commit hash.

**Development philosophy:** one approved module at a time. Don't redesign completed modules absent a real
architectural problem or explicit request. Prioritize maintainability, scalability, performance, and
production readiness over quick fixes. Every feature must be compatible with: multi-country operation,
Active Country filtering, the future Admin Web App, Google Sheets (current), PostgreSQL (future), iOS,
Android, and Web.

## 15. Admin Web App Parity — Permanent Rule (stakeholder instruction, 2026-07-31)

Issued as a standing policy for the remainder of the project. Supersedes nothing above, but adds a binding
constraint on top of every future module.

**The Admin Web App is a first-class application**, equal in importance to the Donor and Institution
applications, and is the operational control center of the platform. It must evolve together with Donor and
Institution and must never fall behind them again.

**Permanent development rule:** whenever a new feature is added to Donor or Institution, immediately ask
*"How will the Admin manage this feature?"* If there is no Admin interface or workflow to manage it, the
feature is not complete. No user-facing functionality ships without corresponding administrative
functionality unless the stakeholder explicitly approves a temporary exception.

**Synchronization:** every workflow implemented in Donor or Institution must also have the necessary Admin
screens, actions, approvals, reports, permissions, and notifications. No workflow bypasses Admin unless
explicitly designed to.

**Admin's eventual scope** (built incrementally, not all at once): Dashboard (platform/donation/institution/
donor/company/country/success-story stats, recent activity, pending approvals); Users (view, search,
suspend, reactivate, manage roles, reset accounts); Institutions (registration review, approval, profile/
logo review, Needed-Items change approval, verification management); Donations (view/search/filter by
country/status, donor/institution/photo/Public Donation Code visibility, full lifecycle tracking, dispute
resolution); Success Stories (review, approve/reject/return-with-comments, publish gating — nothing goes
live pre-approval); Corporate Accounts (create/edit/suspend companies, invitation codes — single-use,
multi-use, expiring, max-usage — employee/impact/donation visibility); Countries (Active/Inactive/Coming
Soon, launch management, per-country settings and stats); Notifications (history, manual send, broadcast,
delivery review); Reports (donations, institutions, companies, users, countries, success stories, platform
activity); Settings (platform/country/app configuration, feature flags).

**Before considering any feature complete, verify:** Donor implementation ✓ · Institution implementation ✓ ·
Admin implementation ✓ · database updated ✓ · notifications updated ✓ · timeline updated ✓ · permissions
verified ✓ · documentation updated ✓ · end-to-end tested ✓.

**Immediate priority (2026-07-31):** before any major new feature phase, perform a comprehensive review of
the Admin Web App against Donor/Institution, and bring Admin to functional parity with what already exists
in those two apps. Only after that parity is reached should development continue into the next major phase.
