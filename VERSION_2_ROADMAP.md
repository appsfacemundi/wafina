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

## Cross-cutting / Infrastructure

- **Automated test suite** — not currently a "new feature," but noted here because building one is itself a
  substantial scoped effort; see `PRODUCTION_READINESS_REPORT.md` for why this is ranked as the top launch
  risk rather than a V2 nice-to-have.
- **API rate limiting**, **migration-history tooling**, and other hardening items are tracked in
  `PRODUCTION_READINESS_REPORT.md`'s launch checklist, not here — they qualify as production-readiness work
  under the Feature Freeze and should happen before or alongside V1, not be deferred to V2.
