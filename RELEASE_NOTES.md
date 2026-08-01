# Wafina — Release Notes

## Version

**v1.0.0-RC1** (Release Candidate 1). Package versions across all workspaces remain at the internal
`0.0.1` dev baseline — no tag has been cut yet. Per `WAFINA_PILOT_LAUNCH_CHECKLIST.md`, `v1.0.0-beta`
gets tagged only once this checklist's remaining open items are closed.

## Build Date

2026-08-02

**Build artifacts: not yet generated this round.** This RC1 pass covered blocker review, cleanup, and
configuration verification only. Producing real Android APK/AAB, an iOS TestFlight build, and
production-pointed Web/Admin builds is blocked on two stakeholder decisions, both already flagged open
in `WAFINA_PILOT_LAUNCH_CHECKLIST.md`:

1. **API hosting** — `apps/api` currently runs only as a local dev process; no host, domain, or SSL is
   configured. All three web apps' `.env.local` still point `NEXT_PUBLIC_API_BASE_URL` at
   `http://localhost:4000`. A build made today would not be reachable by a real remote pilot user.
2. **Mobile signing/build credentials** — neither `apps/mobile-donor` nor `apps/mobile-institution` has
   an `eas.json`. A signed Android APK/AAB and an iOS TestFlight build need an EAS project, a Google Play
   signing keystore, and an Apple Developer Program membership, none of which are confirmed set up yet.

Once both are resolved, generating the five build artifacts is the direct next step.

## Fixed Issues (cumulative, this stabilization cycle)

- Android: broken photo uploads and a silent auth-failure bug fixed and live-verified.
- All three web apps: silent auth-failure bounce fixed — a Firebase-signed-in-but-backend-rejected
  session (suspended account, no matching row) used to land the user back on the logged-out screen with
  no explanation; now the sign-in form's own error banner catches it before navigating away.
- Google Drive: corrected the photo/logo thumbnail URL format (`thumbnail?id=` instead of `uc?id=`),
  fixing every photo rendering as a broken image cross-origin.
- API: rate limiting (3-tier, `express-rate-limit`), structured JSON request/error logging, and a working
  Sheets-to-JSON backup script (`apps/api/scripts/backup-sheets.ts`) all added and live-verified.
- Admin Reports: CSV/formula-injection gap fixed.
- Admin: donation-visibility gap fixed.
- Admin Web App brought to full feature parity — Users (search/suspend/reactivate/role-change/password
  reset), Countries (activate/create), Disputes (resolve), Corporate Accounts (full CRUD + a real
  Invitation Codes system with expiration/max-usage), Notifications (manual send + scoped broadcast +
  history), Reports (6 types + CSV export).
- Full i18n sweep across backend-originated user-facing strings.
- iOS: Donor and Institution full donation lifecycles (claim → schedule → collect → deliver), Success
  Story creation with photo, and the institution logo-upload change-request path all live-verified this
  cycle via server logs and Sheets read-back.
- Android: Donor and Institution full lifecycles live-verified.
- RC1 cleanup: removed 8 leftover one-off `tmp-*.ts` debug/verification scripts from
  `apps/api/scripts/` (unreferenced anywhere, safe to delete).

## Known Limitations (deliberate scope decisions, tracked in `VERSION_2_ROADMAP.md`)

- No automated test suite anywhere in the codebase — all verification to date has been manual, live QA.
- Google Sheets' per-minute rate limit is mitigated (retry-with-backoff) but not eliminated under
  sustained (not just bursty) load.
- Admin cannot edit or cancel a donor's raw donation (no support-override path).
- Admin cannot suspend a verified institution after the fact (only reject before verification).
- No per-country statistics rollup for Admin.
- No pagination on any list endpoint; a few N+1-shaped Admin lookups — fine at pilot scale.
- Corporate Account logo upload not built (cosmetic gap only).
- Settings / feature flags: deferred — nothing in the codebase reads a flag or setting today.
- Reports: no date-range/status filtering or charts yet.
- One pre-existing orphaned `Corporate_Account_ID` data pointer on a real Donor row — handled gracefully
  (`getCorporateAccountById` returns `null`), not urgent.
- No recurring/scheduled backup — the export script works and was run successfully against production,
  but scheduling depends on the still-open hosting decision.
- No dedicated error-tracking or uptime-monitoring service — structured logging exists and is ready for
  any log aggregator, but nothing is currently wired to alert on failures.
- Backup **restore** path is untested — the export direction works, restoring into a fresh sheet has
  never been tried.
- No systematic schema-validation layer at the API boundary (validation is thorough but ad hoc,
  per-service `ValidationError` checks rather than e.g. `zod`).

## Remaining Observations (unconfirmed — need a live human/device retest, not simulator automation)

- **Donor Home "Sair" (sign out) button**: unresponsive across 7+ iOS Simulator tap attempts (varied
  coordinates and gesture types). The underlying `signOut(firebaseAuth)` call itself is proven working
  via a different path (the suspended-account forced-signout test hits the exact same code). Every other
  button on the same screen responded normally. Suspected simulator-automation tap-registration artifact,
  not a confirmed app bug.
- **Institution SignUpScreen "Criar conta"**: produced zero server signal (no `POST /auth/session`) across
  5 consecutive iOS Simulator attempts, including after a confirmed clean component-state reset with a
  short, cleanly-typed email/password. Institution's own "Sair" button worked correctly the same session,
  so this is not the same class of issue as the Donor bug above — it appears specific to this screen's
  submit path, and its root cause (tap not registering vs. a silent client-side Firebase failure) is
  undiagnosed by design, per an explicit stop-and-preserve-the-finding instruction rather than continued
  blind screenshot-driven guessing.

Both items are flagged Low/Medium priority and Unconfirmed — neither blocks RC1 preparation, but both
should be retested on a real device or a fresh simulator session before being ruled in or out as real bugs.

## Configuration Verified This Round

- `apps/api/.env.example` matches every environment variable actually read by `config/env.ts` — no drift.
- Real `.env`/`.env.local` files are correctly gitignored; only `.env.example` is tracked.
- Firebase: a single consistent project (`wafina-98a3a`) is used identically across the API, all three
  web apps, and both mobile apps — no dev/prod project split exists in this architecture.
- Google Drive: production Shared Drive is configured; upload path uses the corrected thumbnail URL.
- Image uploads: all three upload routes (donations, success stories, institution logos) consistently
  cap at 8MB and filter to `image/*` via multer.
- Notifications: the generic Notification Engine (13+ event types, single write path, failure-tolerant)
  plus Admin manual-send/scoped-broadcast/history are complete and require no further changes under the
  current feature freeze.
