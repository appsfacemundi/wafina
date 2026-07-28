# WAFINA — DEVELOPMENT RULES

These rules govern how `MASTER_SPECIFICATION.md` is implemented. They apply to every module, for the life of Version 1. Confirmed by stakeholder 2026-07-27.

---

## 1. Database

Google Sheets ("Wafina Database") is the **single, primary production database** for Version 1. Do not migrate to PostgreSQL, MySQL, Supabase, or any other database. Do not stand up a second data store of any kind (no cache-as-source-of-truth, no shadow DB). Both AppSheet Admin and the new production apps read and write the **same** Google Sheets file.

## 2. Synchronization

There is no sync/replication layer in Version 1, because there is only one database. The REST API reads and writes Google Sheets directly. Admin (AppSheet) reads and writes the same Sheets directly. Changes from either side are immediately visible to the other — no migration pipeline, no queue-based replication between two systems.

## 3. AppSheet / Admin

AppSheet Admin is permanent. Never rebuild it, never redesign its workflows. It is the reference implementation for business logic — when in doubt about how something should behave, match what AppSheet already does.

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
- Preserve compatibility with the current AppSheet implementation at all times.
