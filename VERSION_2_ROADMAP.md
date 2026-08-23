# WAFINA — Version 2 Roadmap

Everything here is a real idea worth doing, deliberately **not** built during the Version 1.0 Feature Freeze
(`DEVELOPMENT_RULES.md` §16, effective 2026-07-31). Nothing on this list is a bug or a production-readiness
gap — those live in `PRODUCTION_READINESS_REPORT.md` and get fixed regardless of the freeze. This file is
purely a parking lot for new capability, so ideas don't get lost *and* don't get built prematurely.

When Version 2 planning starts, triage this list — not everything here will make the cut, and new items
will come up that aren't here yet.

## Admin Web App

- **Settings / Feature Flags** — deferred because nothing in the codebase reads a flag or setting today.
  Revisit once a real configuration need exists (candidates: donation quantity soft-limits per country,
  enabling/disabling specific item types, toggling the corporate-invite feature).
- **Per-country statistics view** — Admin's Countries page currently only activates/adds countries; there's
  no rollup of "X institutions, Y donations, Z donors" per country, even though `Country_ID` is present on
  every relevant record. Was part of the original Admin capability list; scoped out of the parity program as
  a nice-to-have rather than a blocking gap.
- **Admin donation edit/cancel** — Admin can view every donation and set logistics estimates, but cannot
  edit a donation's core fields or cancel one on a donor's behalf (e.g. a data-entry mistake, or a donor who
  wants to withdraw a still-Pending donation and can't reach support any other way). Today only the donor
  themselves can edit, and only while Pending.
- **Corporate Account logo upload** — the `Logo` field exists and displays wherever a company's identity
  shows up, but there's no self-service upload UI; only a direct Sheet edit sets it today.
- **Reports enhancements** — charts/visualizations, date-range filtering, and scheduled/emailed reports.
  Today's Reports page is a first pass: table + CSV export only.
- **Suspend/reactivate a verified institution** — Admin can approve or reject an institution *before*
  verification, but has no way to deactivate one afterward if it turns out to be a problem post-launch
  (e.g. abuse reports, a closed organization). Would need a new backend function + route (same shape as
  `suspendUser`/`suspendCorporateAccount`), which is new capability, not a bug fix — deliberately deferred
  rather than added under the polish pass that surfaced it (2026-07-31).

## Platform / Geography

- **Active-Country filtering audit** — explicitly paused by the stakeholder before the stabilization phase.
  Covers Success Stories/Notifications filtering by Active Country, and any other place country scoping
  should apply but hasn't been audited yet.
- **Phase 4 — logistics display decision**: replace (or keep alongside) the current Admin-settable Expected
  Collection/Delivery *dates* with a stage-only display ("Collection Scheduled / In Transit / Delivered",
  no promised dates) — the stakeholder's stated reasoning is that promising dates the platform can't
  guarantee hurts credibility before real logistics partners exist. This is a genuine product decision about
  an *existing* feature (built in Module 6), not a bug fix — needs explicit stakeholder sign-off before
  either building or removing anything.
- **Country launch tooling beyond Active/Coming-Soon** — e.g. a staged rollout flow, launch-date scheduling,
  or per-country feature gating.

## Corporate Accounts

- **Corporate dashboard** — a company-facing view of its own employees' aggregate donation impact (distinct
  from Admin's own view of the same data, which already exists).
- **Corporate secure invitations** beyond the current invite-code system — e.g. email-based invitations sent
  directly from Admin rather than a code the company distributes itself.

## Donor & Institution Mobile

- ~~**Take Photo + Choose from Gallery (both apps)**~~ — **DONE, 2026-08-05/06.** `DonateScreen` (Donor),
  `SettingsScreen`'s logo upload (both apps), and `NewSuccessStoryScreen` (Institution) all now offer a
  Camera/Gallery `Alert.alert` choice feeding the same existing `uploadFile()` pipeline. Kept here
  struck-through rather than deleted so the `CAMERA`/`RECORD_AUDIO` permission-retention rationale above
  stays discoverable. No further action needed.

- **Push notifications (both apps)** — user question, 2026-08-06: today `Notifications` is pure in-app pull
  (`NotificationsScreen` fetches `/notifications` once on mount, no polling, no OS-level alert, no tab-bar
  unread badge) — nothing tells the user something new arrived unless they happen to open that tab. A real
  push implementation needs `expo-notifications`, a device push token registered per user (Expo Push
  Service, or direct FCM/APNs), a `POST /notifications` server-side hook to actually send the push at
  creation time (`apps/api/src/services/notifications.ts`'s `createNotification`), and a test device/build to
  verify delivery — not something Expo Go can demo, since remote push requires a registered dev-or-prod
  build. Scoped as V2, not a launch blocker: current in-app list is functionally correct, just not
  proactive. **Why:** falls under Version 1 Feature Freeze — this is new functionality, not a bug fix.

- **Proactive cross-app role-mismatch check on session restore (both apps)** — found during RC1 Epic 0
  live-workflow verification, 2026-08-06: a saved Firebase session for a wrong-role account (e.g. an
  Institution account's session restored inside the Donor app, or vice versa) currently routes straight to
  that app's onboarding/profile-completion screen, and the mismatch is only caught when the user submits the
  form — the backend's `requireRole` gate (`apps/api/src/middleware/auth.ts:97-111`) rejects it with "Esta
  conta está registada como X, não é possível continuar aqui." RC1 fix (same day): both onboarding screens
  now have a "Não é a sua conta? Sair" escape hatch (Donor's `OnboardingProfileScreen.tsx`, matching
  Institution's pre-existing `RegisterScreen.tsx:220-221` pattern), so the user is never fully stuck — but
  they still have to hit the error once before finding the way out. Stakeholder-proposed V2 improvement:
  validate the restored session's role *before* navigating to onboarding at all, and if it doesn't match the
  current app, show an immediate "Esta conta pertence à aplicação Wafina Instituição. Pretende terminar
  sessão?" prompt with "Sair" / "Abrir Wafina Instituição" options — eliminates the dead-end (and the wasted
  form-fill) entirely instead of just providing an exit from it. Needs a session/role check added early in
  each app's `RootNavigator.tsx`, before the `!session.profileComplete` branch.

- **Multiple photos per donation (max 10, first = cover)** — stakeholder request, 2026-08-13: today
  `Donation.Photo` is a single string; a high-value item (the stated example: a car) needs several
  angles (front/rear/sides/interior/odometer/damage) to be properly assessed by a recipient before
  claiming. Full audit + implementation plan already written:
  [`V2_MULTIPHOTO_AND_DISTANCE_PLAN.md`](V2_MULTIPHOTO_AND_DISTANCE_PLAN.md) §1 — new `Photos:
  string[]` field (JSON-in-cell, same pattern as `Institution.Review_History`), `Photo` becomes a
  derived cover alias for backward compatibility, `multer.single()` → `multer.array('photos', 10)`,
  client-side resize via `expo-image-manipulator` (new dependency) before upload, gallery viewer needed
  on 4 screens (MyDonations, AvailableDonations, Receber, Admin donation detail). Fully additive — no
  migration needed, old rows/builds keep working. **Why V2:** new functionality, not a bug fix, plus
  needs a fresh EAS build for mobile-donor to reach real users regardless of freeze status.

- **GPS-based distance + confirm-before-claim (Institution/Animal Shelter)** — stakeholder request,
  2026-08-13, same session as above: a donation may match a recipient's category but be impractically
  far (the stated example: donor in Porto, recipient in Lisboa). Full plan in
  [`V2_MULTIPHOTO_AND_DISTANCE_PLAN.md`](V2_MULTIPHOTO_AND_DISTANCE_PLAN.md) §2 — new shared
  `haversineDistanceKm()` util, `Distance_Km` computed onto `InstitutionDonationView` from the
  already-stored `Donation.Location`/`Institution.Location` (no schema change needed for this part), a
  confirm dialog ("Sim, Aceitar" / "Não, Voltar") shown on `AvailableDonationsScreen` above a
  configurable threshold tier, never an automatic rejection. Recommended thresholds (10/30/75/150km)
  are geography-aware, not a literal copy of the stakeholder's example numbers — see the plan's
  reasoning. **Important open finding, not yet resolved:** this doesn't map cleanly onto the
  People/RECEBER category — every individual recipient already picks up from one fixed per-country
  Collection_Point, not the donor's own location, so a per-donation distance has no natural meaning
  there. Three scoping options are laid out in the plan's §2.1; needs a stakeholder decision before any
  RECEBER-side code gets written. **Why V2:** new functionality, plus needs a fresh EAS build for
  mobile-institution (and mobile-donor if the RECEBER piece is approved) to reach real users.

## Donor Loyalty / Gifts

- **Donation-count milestones + gift emails** — stakeholder idea, 2026-08-13: after a donor crosses a
  threshold number of completed donations (e.g. 5/10/25), automatically send a congratulations email letting
  them know they've earned a gift and inviting them to contact Wafina to claim it (no in-app redemption flow
  — contact-to-claim only). Straightforward to build on top of existing data: every donation already carries
  `Donor_ID` and reaches `Status: 'Delivered'`, so the milestone count is just "how many Delivered donations
  does this donor have" — no new tracking scaffolding needed. The natural trigger point is `confirmDelivery()`
  in `apps/api/src/services/donations.ts`, the same place Email #2 (thank-you) already fires. Needs: a
  milestone→gift config (candidate: Admin-editable rather than hardcoded, so thresholds/gifts can change
  without a deploy), a third email template, a per-donor "already notified for this milestone" flag to avoid
  re-sending, and — per the Admin-parity policy — an Admin-side view of who's hit a milestone and whether
  they've been contacted/redeemed. **Why V2:** new functionality, not a bug fix, and both apps are currently
  in App Store/Play Store review — falls squarely under the Version 1 Feature Freeze.

## Email Branding

- **Branded password-reset email** — today's reset flow uses Firebase Auth's own built-in
  `sendPasswordResetEmail()` (client SDK, confirmed in all three `AuthContext.tsx` files), which sends
  Firebase's default plain-text template — no Wafina logo, no bougainvillea pink, unlike the 3 Resend-based
  lifecycle emails. Attempted to customize the template directly in Firebase Console
  (Authentication → Templates → Password reset, project `wafina-98a3a`) on 2026-08-13, but the console
  returned "Email template updates are currently unavailable for this project. For assistance with template
  changes, contact Firebase Support" — a Firebase-side restriction, not fixable from the codebase. The
  underlying reset flow still works fine today; this is purely cosmetic. Real V2 fix: stop using Firebase's
  built-in reset email entirely and build a custom reset-link flow through the existing Resend pipeline
  (`apps/api/src/services/email.ts`), matching `EMAIL_LOGO_HTML`/`EMAIL_BRAND_COLOR` like the other 3
  lifecycle emails — more code work (custom token generation/verification) but full control over branding.
  **Why V2:** cosmetic polish, not a launch blocker, and new functionality under the Version 1 Feature Freeze.

## Cross-cutting / Infrastructure

- **Automated test suite** — not currently a "new feature," but noted here because building one is itself a
  substantial scoped effort; see `PRODUCTION_READINESS_REPORT.md` for why this is ranked as the top launch
  risk rather than a V2 nice-to-have.
- **API rate limiting**, **migration-history tooling**, and other hardening items are tracked in
  `PRODUCTION_READINESS_REPORT.md`'s launch checklist, not here — they qualify as production-readiness work
  under the Feature Freeze and should happen before or alongside V1, not be deferred to V2.
