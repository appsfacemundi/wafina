# WAFINA — Pilot Launch Checklist

The final milestone before inviting real users. Per `DEVELOPMENT_RULES.md` §16 (Version 1.0 Feature Freeze),
the only work between here and pilot launch should be finishing this checklist and fixing whatever it turns
up — no new functionality.

Every item below reflects a real, checked state as of 2026-07-31, not an assumption. Where something is
already true, it's marked done and says how it was verified. Where something genuinely isn't done yet, it's
left open — this file is meant to be checked off for real as the remaining items get done, not treated as
already complete.

**Recommended sequence** (per the stakeholder's own plan): finish this checklist → fix only what it surfaces
→ tag `v1.0.0-beta` → launch to a small real pilot (e.g. 5–10 institutions, 50–100 donors) → collect feedback
→ plan V1.1/V2 from what's learned, not from further speculation.

---

## Infrastructure

- [ ] **API deployed** — currently runs only as a local dev process (`tsx watch`); no production host is
      configured in this repo. Needs a decision on where this runs (the stakeholder hasn't specified a host).
- [ ] **SSL configured** — depends on the deployment above.
- [ ] **Domain configured** — depends on the deployment above.
- [x] **Environment variables documented** — `apps/api/.env.example` lists every required variable
      (`FIREBASE_*`, `GOOGLE_SERVICE_ACCOUNT_*`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_DRIVE_SHARED_DRIVE_ID`,
      `ALLOWED_ORIGINS`, `PORT`); `.env`/`.env.local` are gitignored, only the example is tracked.
      *Still needed:* the actual production values set on whatever host is chosen.
- [~] **Google Sheets backup configured** — `apps/api/scripts/backup-sheets.ts` (`npm run backup
      --workspace=apps/api`) exports every tab to timestamped JSON; live-run against production, all 10 tabs
      backed up successfully. *Still needed:* wiring this into a recurring schedule against persistent
      storage — depends on the deployment-host decision above, so it can't be fully "configured" yet, only
      proven to work.
- [~] **Monitoring enabled** — structured JSON request/error logging is now in place (one line per request:
      method/path/status/duration/userId/role; unexpected errors log the same shape plus a stack trace), so
      any log aggregator or hosting-provider log viewer can ingest it with no further setup. *Still needed:*
      an actual dedicated error-tracking or uptime-monitoring service (e.g. Sentry, a health-check pinger) —
      logging alone isn't the same as being alerted.

## Security

- [x] **Authentication verified** — Firebase Auth is identity-only; every protected route re-verifies the ID
      token and re-fetches the caller's row fresh from Sheets on every request. Live-tested repeatedly this
      session, including a suspended-account rejection at both `requireAuth` and the login endpoint itself.
- [x] **Authorization verified** — `requireRole('Admin')` confirmed present on all 32 Admin routes by direct
      `grep`, not assumed.
- [x] **Admin permissions verified** — suspension takes effect immediately (no stale session can bypass it);
      role-change is hard-restricted to Donor↔Institution with no path to grant Admin access.
- [x] **Rate limiting enabled** — three-tier `express-rate-limit`: a generous global limiter, a tighter one
      on `/auth/session`, and a dedicated one on `/geo-regions/geocode` (protects the free Nominatim proxy's
      own usage policy, not just this app's resources). Live stress-tested up to 250 concurrent requests with
      graceful, friendly failures — never raw errors — once a limit is hit.
- [x] **CSV injection fixed** — found and fixed in the Admin Reports export (leading `=`/`+`/`-`/`@`
      neutralized before quoting).
- [~] **Input validation verified** — extensive per-service `ValidationError` checks exist throughout, but
      there's no systematic schema-validation layer at the API boundary (e.g. no `zod` or equivalent) —
      validation is thorough but ad hoc, not systematic. Reasonable for a pilot; worth hardening later.
- [x] **File upload validation** — every upload route (donations, success stories, institution logos) is
      size-capped at 8MB and MIME-filtered to `image/*`, checked directly in the multer configs.

## Donor

- [x] **Registration** — Email/Password, Google, Apple sign-in; profile completion flow verified live.
- [x] **Login** — verified live this session with a disposable account. A real bug was found and fixed
      during the production-hardening round: a suspended account's sign-in was silently bounced to the
      logged-out screen with no explanation; now shows "Esta conta foi suspensa" directly on the form,
      verified live for both the failure and the normal success path.
- [x] **Donation** — submission verified live with a real photo upload and quantity 75,000 (old 10,000 cap
      confirmed gone).
- [x] **GPS** — address/geocoding fallback verified live end-to-end (Nominatim); no manual Lat/Lng anywhere.
- [x] **Photos** — upload and display verified live.
- [x] **Notifications** — verified live, including working deep-links (tapping a notification navigates to
      the relevant screen).
- [x] **Impact Stories** — the `/impact` tab verified live, correctly empty before a story exists and
      correctly populated after Admin approval.

## Institution

- [x] **Registration** — same GPS/address flow as Donor, verified live.
- [x] **Approval** — Admin verify/reject flow verified live with a real disposable institution.
- [x] **Needed Items** — the leaked-field-name bug (`Needs_List` shown raw) is fixed and re-verified; the
      change-request dropdown and confirmation toast both show "Itens Necessários."
- [x] **Donation acceptance** — full lifecycle (accept → schedule → collect → deliver) verified live, each
      stage timestamped and toast-confirmed.
- [x] **Delivery** — confirmed live; the one transient error seen during rapid testing was root-caused to
      the (now-mitigated) Sheets rate limit, not a real bug.
- [x] **Success Story** — submission, Pending status, Admin approval, and cross-app propagation to both the
      Donor App and the Institution's own list all verified live.
- [x] **Timeline** — every stage shows date **and** time, verified live.

## Admin

- [x] **Users** — search/suspend/reactivate/role-change/password-reset, all verified live with a disposable
      account (including confirming a suspended account is rejected at both login and every subsequent call).
- [x] **Institutions** — approve/reject verified live; the pending-review card now also shows the
      institution's logo, coordinates, service radius, and coverage area before Admin decides (previously
      Admin had to approve or reject "blind" to all of that).
- [x] **Companies** — full CRUD (create/edit/suspend/reactivate) verified live.
- [x] **Invitation Codes** — generation, redemption, usage-limit enforcement, and the suspended-company
      rejection path all verified live (including a real ordering bug found and fixed: a rejected join no
      longer silently consumes a limited-use code).
- [x] **Donations** — Admin can now view **every** donation including Pending ones (fixed during the
      Production Readiness follow-up; previously only claimed-onward donations were visible anywhere in Admin).
- [x] **Reports** — all 6 report types verified live; CSV export verified, including the formula-injection
      fix.
- [x] **Notifications** — manual single-user send and scoped broadcast (role/country-filtered, never an
      unscoped blast) both verified live, including the "at least one filter required" guard.
- [x] **Countries** — activate/add verified live.
- [x] **Success Stories** — approve/reject verified live, including cross-app propagation.
- [ ] **Settings** — deliberately not built; nothing in the codebase reads a flag or setting yet. Not a
      pilot blocker.

## End-to-End

- [x] **Complete workflow verified** — Donor → Institution → Admin → Success Story → Reports → Notifications
      → Stats, run once as one continuous live sequence with disposable accounts. Re-run again after the
      production-hardening round (rate limiting, logging, i18n sweep, auth-flow fix) via a disposable-account
      E2E script driving the full lifecycle directly against the live API, including two deliberate
      translated-error assertions — all steps passed.
- [x] **Notifications verified** — fired correctly at every step above, each with a working deep-link.
- [x] **Reports verified** — reflected the same real data the live run produced.
- [x] **Statistics verified** — Admin dashboard stats incremented/decremented correctly at every stage,
      confirmed back to the exact real-data baseline after cleanup.
- [x] **Corporate workflow verified** — a donor joining a company via invitation code, including the
      suspended-company and exhausted-code rejection paths.
- [ ] **Country filtering verified** — **not done.** This is the Active-Country filtering audit, explicitly
      paused by the stakeholder before the stabilization phase. Currently only Angola is `Active`; Portugal
      and every other CPLP country are `Coming Soon`. If the pilot includes more than one country, this needs
      to happen first.

## Pilot Readiness

- [x] **Test users removed** — verified today by scanning every one of the 10 Sheet tabs (`Users`,
      `Donations`, `Institutions`, `Disputes`, `Corporate_Accounts`, `Change_Requests`, `Notifications`,
      `Geo_Regions`, `Success_Stories`, `Invitation_Codes`) for any `tmp.*` email, "Stab Test", or "QA Test"
      pattern — zero matches. The one persistent account (`wafina.admin.testing@gmail.com`) is intentional,
      not test debris, and meant for the stakeholder's own ongoing use.
- [x] **Test data removed** — same scan; all disposable donations, institutions, success stories, and
      notifications created during this project's many live-testing rounds were deleted immediately after
      each round, verified clean today (re-confirmed after the production-hardening round's own E2E and
      polish-pass testing, including catching and removing a broadcast-notification test message that had
      gone out to every real Donor account — a real find from taking this scan seriously rather than treating
      it as a formality).
- [x] **Backup completed** — a real backup now exists: `apps/api/scripts/backup-sheets.ts` run against
      production, all 10 tabs exported successfully to timestamped JSON.
- [ ] **Recovery tested** — restoring *from* that backup into a fresh sheet has not been tried; the export
      works, the restore path doesn't exist yet.
- [ ] **Version tagged (`v1.0.0-beta`)** — deliberately not done yet, per the stakeholder's own sequencing:
      tag only after this checklist is finished and whatever it surfaces is fixed.

---

## Summary

**38 of 48 items done and verified, 3 partial, 7 remain open** (up from 36 done / 1 partial / 11 open). The
production-hardening round closed rate limiting and produced a real, verified backup — both previously fully
open — and turned "Sheets backup configured" and "Monitoring enabled" from fully open into partial (the
mechanisms exist and work; scheduling/dedicated alerting still depend on the deployment-host decision). What
remains open is concentrated almost entirely in Infrastructure (deployment target, SSL, domain — nothing here
can proceed without a stakeholder decision on where this actually runs) plus the one item still gated behind
it (recovery test), the paused Country-filtering audit, Settings (deliberately deferred, not a blocker), and
the final version tag. **Donor and Institution are both 100% (7/7)**; Security is 6/7 with the remaining item
already partial, not open; Admin is 9/10 (only Settings open, not a blocker); End-to-End is 5/6 (only the
paused Country-filtering audit open) and its complete-workflow item was independently re-verified this round.
Nothing here is a "the app doesn't work" gap — it's deployment decisions, hardening depth, and items already
deliberately deferred.
