# Project Status - WAFINA Platform

**Last updated:** 2026-07-30
**Updated by:** Claude Code, after completing Phase 3A Module 3 (Country Expansion + Selector UX)
**Current state:** Phase 3 review complete. Phase 3A underway, working module by module. Modules 1, 2, and 3 are implemented and verified. The stakeholder issued a new "master prompt" (see below) substantially expanding Phase 3A's scope — it has been broken into Modules 3–9 rather than built as one change, per the stakeholder's own "one module at a time" rule. Three open design decisions from that prompt were resolved with the stakeholder before any implementation began (see "Master Prompt Decisions" below).

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

**Status:** COMPLETE. Full report at `PHASE3_ARCHITECTURE_REVIEW.md` (project root) — read that file for
the full findings, not this summary.

**Method used:** Full re-read of `MASTER_SPECIFICATION.md` (all 32 sections) + `DEVELOPMENT_RULES.md`,
5 parallel deep-research passes (backend/DB/API, notifications, Donor mobile UX, Institution mobile UX,
both web apps), plus direct first-hand verification of every headline claim against actual source code —
not taken on a sub-agent's word alone.

**Headline findings (see the full report for all ~30 classified recommendations):**
1. **[MAJOR]** No bridge from Admin actions (AppSheet) back into the app — institutions currently have
   no way to learn they've been verified/rejected except repeatedly reopening the app. 4 of 7 spec'd
   notification events can never fire under the current architecture.
2. **[MAJOR]** N+1 performance pattern on the Institutions browse screen — every institution's stats
   trigger a full re-read of the entire Donations tab. No caching/pagination/retry anywhere in the
   Sheets access layer.
3. **[MAJOR]** Multi-country is not yet a data concept — `Users.Country` exists but is used nowhere;
   Institutions/Donations have no country field at all.
4. **[MAJOR]** Zero automated tests exist, despite spec §31 requiring them.
5. **[MAJOR]** Zero i18n scaffolding and zero accessibility props anywhere, despite dev rules requiring
   i18n-readiness from day one.

**Production readiness score:** ~64% for a controlled Angola pilot (the near-term goal per spec's own
phased rollout); ~34% for the stated long-term goal of a multi-country platform serving millions — these
are two different bars and the report scores both separately rather than blending them into one
misleading number.

**Minor items — implemented and committed this session:**
- Removed hardcoded `pt-PT` locale from 6 date-formatting call sites (now uses device default)
- Deleted a stale, schema-mismatched dead script (`tmp-seed-donation.ts`)
- Fixed forced `autoCapitalize="none"` on 3 proper-noun name fields

**Medium/Major recommendations:** NOT implemented. All ~27 remaining items are documented in the full
report with impact/DB implications, classified, and organized into a 5-phase roadmap (Phase 3a pre-launch
hardening → 3b post-launch hardening → Phase 4 multi-country → Phase 5 growth features → deferred
post-V1 items). Waiting on stakeholder approval before touching any of them.

**Explicit constraint honored:** Admin Panel (AppSheet) was not touched or scoped for redesign — reviewed
only where its behavior affects the Donor/Institution apps' workflows, per instruction. That rebuild
begins only after Phase 3's Medium/Major items are approved and (at least Phase 3a) implemented.

---

## Phase 3A — Foundation Hardening & Global Platform Architecture

**Status:** IN PROGRESS. Working module by module per stakeholder's explicit process: design → explain →
approval (Medium/Major) → implement → report → update this file, before starting the next module.

### Module 1 — Global Multi-Country & Geographic Architecture: COMPLETE

**What changed:**
- New permanent data model: a single self-referencing `Geo_Regions` tab (`Region_ID`, `Name`, `Level`,
  `Parent_Region_ID`, `Country_ID` [denormalized ancestor pointer], `ISO_Code`, `Active`) instead of
  fixed Country/Province/Municipality tables — supports any country's real administrative depth without
  a schema change. Seeded with 5 countries: Angola (`Active=TRUE`), Portugal/Brazil/Moçambique/Cabo Verde
  (`Active=FALSE`, ready to launch by flipping one flag).
- `Users`: added `Home_Country_ID`, `Active_Country_ID`, `Switch_Preference` (`Always_Ask` /
  `Never_Ask_Automatically`). Replaced the old free-text `Country` field entirely (was already only
  test data — one row even had `Country="Luanda"`, a province, not a country, which is exactly the drift
  a real FK prevents). "Current GPS Country" is deliberately **not stored** — computed client-side each
  session, see `packages/shared/src/lib/geo-detect.ts`.
- `Institutions`: added `Country_ID` (required), `Region_ID` (optional, for future Province/Municipality/
  District), `Service_Radius_Km`, `Coverage_Area`.
- `Donations`: added `Country_ID` — a **permanent snapshot** of the donor's Active Country at submission
  time, not a live join. This was a deliberate correction to my own earlier Phase 3 recommendation (which
  suggested deriving it live) once Active Country became a real, user-changeable concept — a live join
  would let a donation silently "move" countries if the donor later travels. Flagged and explained rather
  than silently changed.
- New API: `GET /geo-regions/countries`, `GET /geo-regions/:id/children`, `PATCH /users/me/active-country`,
  `PATCH /users/me/switch-preference`. `listVerifiedInstitutions`/`listAvailableDonations` now take an
  optional country filter; Donor-side browsing filters by the donor's Active Country, Institution-side
  browsing filters by the institution's own `Country_ID` (its operating country, not a personal toggle).
- New client UX: real country pickers (replacing free text) on Donor onboarding, Donor Settings, and
  Institution registration; a "País ativo" section in Donor Settings (view/change Active Country, set
  switch preference); a GPS-assisted switch-country prompt (mobile + web) that runs once per session on
  Home, using free on-device bounding-box country inference — never auto-switches, always requires an
  explicit tap.

**Why:** This is the foundational data model every other multi-country capability (institutions, reports,
notifications, dashboards, maps, future payment/transport/government integrations) depends on. Building
it first, correctly, means nothing downstream needs to be redesigned later.

**Benefits:** Wafina can now, in principle, launch a second country by seeding `Geo_Regions` data and
flipping `Active=TRUE` — no redeploy, no schema change. Donors and institutions are cleanly scoped to
the right country by default. A user who travels stays in control: nothing switches without an explicit
tap, and past donations never retroactively move.

**Database implications:** One new tab (`Geo_Regions`, 5 rows today). Additive-only column changes to
`Users`/`Institutions`/`Donations` — existing columns were never removed, reordered, or overwritten, so
AppSheet/Admin views bound to the current layout are unaffected. All 7 existing Users, 4 Institutions, and
23 Donations rows were backfilled to Angola (the only launched market) and verified row-by-row.

**A pre-existing bug surfaced during backfill (not introduced by this module):** `Institutions` has a
duplicate `Institution_ID="bdecb4ed"` — exactly the issue already documented in `MASTER_SPECIFICATION.md`'s
Appendix (item 1) as a known reference-implementation problem requiring production uniqueness enforcement.
It made the key-based `updateRow` helper only reach the first of the two rows during backfill; fixed by
targeting the second row's actual sheet position instead of its (ambiguous) ID. The underlying
duplicate-key problem itself is unresolved — that's the uniqueness-enforcement hardening work already
queued in the Phase 3 report (`DB-1`/general uniqueness gaps), not something patched here.

**Verified:** `npm run typecheck` and `npm run lint` clean across all 7 workspaces. Real HTTP smoke test
(new routes return proper 401s when unauthenticated, confirming middleware wiring). Real service-layer
smoke tests against the live, migrated data: country filtering returns correct institution/donation counts
and empty results for a nonexistent country; `createInstitution`/`createDonation` correctly reject
missing, unknown, and inactive countries. No stray test data left behind (row counts confirmed unchanged
after validation tests, which are designed to throw before any write).

**Not done in this module (explicitly deferred):**
- Country-scoped Admin — deferred to the future Admin Panel rebuild, per instruction not to touch it yet.
- Province/Municipality/District data — schema supports it (`Region_ID`, arbitrary `Level` depth), but no
  rows exist below Country level yet. Pure future data entry, no code change needed.
- Country Configuration (language/currency/transport partners/etc. per country) — explicitly deferred per
  instruction; `Country_ID` is the extension point a future `Country_Config` table would key off.

### Module 2 — Notification Engine + Success Stories MVP: COMPLETE

**What changed, why:**
- **Generic Notification Engine.** `Notifications` was genuinely redesigned, not just extended: `User_ID`
  → `Recipient_User_ID`, `Read` boolean → `Status` enum (`Pending`/`Delivered`/`Read`/`Failed`), `Date_Created`
  → `Created_At`, plus new `Notification_Type`, `Entity_Type`/`Entity_ID` (real deep-linking — closes the
  Phase 3 UX-2 gap), `Priority`, `Delivery_Channel`, `Metadata`. All values are reference vocabularies
  (`packages/shared/src/enums/notification-fields.ts`), not server-enforced whitelists — the same pattern
  already used for `ITEM_TYPES`/`CONDITIONS`/`GEO_LEVELS` — so a future event, entity kind, or delivery
  channel (email/SMS/WhatsApp/push, transport) is pure data, no schema change. `createNotification()` in
  `apps/api/src/services/notifications.ts` is the single write path every event goes through.
  `Delivery_Channel` is hardcoded `'in_app'` today — no provider is integrated, per instruction ("do not
  integrate providers yet").
- **Newly-wired events** (previously missing entirely): `dispute_created` (self-confirmation to the raiser
  — before this, raising a dispute gave no acknowledgement at all), `change_request_submitted`
  (self-confirmation, same gap), `corporate_member_joined` (notifies existing teammates when someone joins
  via invite code), `success_story_published` (notifies the donor).
- **`Change_Requests.Status` formalized** as a real enum (`Pending`/`Approved`/`Rejected`,
  `packages/shared/src/enums/change-request-status.ts`) — was previously an unenumerated string that only
  ever held `"Pending"`.
- **Institution approved/rejected/dispute-resolved/change-request-approved notifications are NOT wired** —
  correctly deferred, since they depend on the Admin→app bridge (Phase 3's BL-1), which doesn't exist yet.
  Not a gap introduced by this module; already documented as a prerequisite.
- **Transport volunteer events** — deliberately not built (no Transport/Volunteer entity exists), per the
  explicit "ensure the architecture will naturally support them later, do not implement now" instruction.
  The generic `Entity_Type`/`Entity_ID` design means wiring transport in later needs zero notification-schema
  changes.
- **Success Stories MVP** (`apps/api/src/routes/success-stories.ts`, `services/success-stories.ts`, new
  `Success_Stories` Sheet tab): verified institutions only, one photo (reuses the same Drive upload path as
  donation photos), title + description (length-validated), tied to a specific `Delivered` donation the
  institution actually delivered (one story per donation, enforced), publishes with `Status=Approved` by
  default since no Admin Panel exists yet to moderate — the status column/enum
  (`packages/shared/src/enums/success-story-status.ts`) is ready for that so a future moderation workflow
  is just an Admin UI + changing the default, not a schema change. Publishing notifies the donor.
- **Client UI, all 4 apps:** Institution web (`apps/institution/src/app/success-stories/new/page.tsx`) and
  mobile (`NewSuccessStoryScreen.tsx`, using `expo-image-picker`) both get a "Publicar história" entry point
  from the Claimed/Delivered donation list, with an inline "published" indicator once one exists. Donor web
  (`donations/page.tsx`) and mobile (`MyDonationsScreen.tsx`) show the published story inline on the
  matching donation card. Notification inboxes on all 4 apps updated to the new schema and now deep-link to
  the actual record via `Entity_Type`/`Entity_ID` instead of a fixed generic screen.

**Database implications:** `Notifications` tab schema genuinely changed (not additive) — the 7 existing
rows (all real data from already-verified claim/deliver flows) were migrated in place, inferring
`Notification_Type` from each message's wording (the only two events ever wired before this module). New
`Success_Stories` tab created, currently empty (0 real stories exist yet — MVP just shipped).

**Verified:**
- `npm run typecheck` and `npm run lint` clean across all 7 workspaces (re-confirmed after this review).
- Real, live smoke tests against the migrated production Sheet (prior session): created a real Success
  Story against a real `Delivered` donation, confirmed the notification fired, confirmed validation rejects
  duplicate/wrong-institution/non-Delivered attempts, then cleaned up the one test row — verified 0 stray
  rows remained.
- This review session independently re-verified the live Sheet state directly (0 `Success_Stories` rows, 7
  `Notifications` rows, all real — no leftover test data), then did a fresh end-to-end **Web** UI pass: real
  Firebase sign-up → onboarding (country picker) → Home → Notifications (empty state, no console errors) →
  Minhas Doações (correctly fetches `/donor/success-stories` alongside donations, renders cleanly). Test
  account (Firebase user + Sheets row) deleted afterward; confirmed back to 7 real Users rows.
- Institution web app boots and renders cleanly; the full verified-institution publish flow (register →
  simulate Admin verification → claim → deliver → publish story) was **not** re-exercised in this review
  session — the underlying service logic was already live-tested (see above), and doing so again would mean
  simulating Admin verification against the real Sheet for no new signal. Flagging this as the one openly
  accepted gap, same spirit as the Android disputes gap already on record.
- iOS/Android client builds were not run in this review session (no simulator/emulator session was spun up)
  — typecheck covers both mobile workspaces, but a personal device/simulator pass is recommended before
  Module 3, per the stakeholder's own test-and-approve process.
- One-off migration/smoke-test/cleanup scripts used to build and verify this module were deleted after use
  (`apps/api/scripts/tmp-*module2*.ts`) — they were disposable, already executed, not permanent tooling.

**Not done in this module (explicitly deferred, consistent with Module 1's scoping):**
- Email/SMS/WhatsApp/push provider integration — architecture is pluggable and ready; no provider chosen or
  wired, per instruction.
- Admin→app bridge (institution approved/rejected, dispute resolved, change request approved notifications)
  — Phase 3's BL-1, not yet built.
- Success Story Admin moderation — schema/enum ready (`Status` column), no Admin UI exists to act on it;
  every story auto-publishes as `Approved` today, matching the "simple MVP" instruction.
- Transport/Volunteer notification events — no underlying entity exists yet; explicitly out of scope per
  instruction, architecture confirmed generic enough to add later without changes to the engine itself.

### Stakeholder "Master Prompt" (2026-07-30) — re-scoped Phase 3A roadmap

The stakeholder issued a consolidated brief covering: universal Active-Country filtering as a platform-wide
rule (§1), CPLP-wide country expansion (§2), a "Coming Soon" country selector (§3), GPS switch behavior
(§4), a dev-only country simulator (§5), a Home screen Active Country banner (§6), a richer Success Stories
feature with Admin approval (§7), short human-readable donation codes (§8), institution logos everywhere
(§9), secure one-time corporate invitations with bulk generation (§11), a corporate impact dashboard (§12),
and confirmation that institutions stay single-country for V1 (§13). Rather than implement this as one
sweep, it was broken into Modules 3–9, consistent with the stakeholder's own "one module at a time, verify
before continuing" rule.

**Three genuinely ambiguous decisions were resolved with the stakeholder before writing any code** (each
was a real fork found by reading the actual current implementation, not a hypothetical):

1. **Donation short codes** — `Donation_ID` (UUID) stays the internal primary key, untouched. New
   `Public_Donation_Code` field, format `<CountryCode>-<SequentialNumber>` (e.g. `AO-000001`), unique and
   never reused per country, shown everywhere user-facing; UUID hidden from normal users. *(Not yet
   implemented — scheduled for Module 6.)*
2. **Corporate invitations** — native AppSheet bulk-generation action (Admin runs it manually inside
   AppSheet), cryptographically random codes, single-use by default but configurable to multi-use, written
   into a new `Corporate_Invitations` tab. No new Admin REST API — consistent with `DEVELOPMENT_RULES.md`
   §3 (AppSheet is permanent, never rebuilt). This is a real deviation from `MASTER_SPECIFICATION.md` §13.2
   (which currently describes one shared company-wide code) — that document needs a matching update
   alongside the Module 8 implementation, not left silently stale. *(Not yet implemented.)*
3. **Success Stories Admin approval** — institution publishes → `Status=Pending` (not shown to the donor
   yet) → Admin flips it to `Approved` directly in the `Success_Stories` Sheet tab (AppSheet) → institution/
   donor see it once Approved, next time they load the app. No push signal on approval yet — that needs the
   still-unbuilt Admin→app bridge (Phase 3's BL-1). *(Not yet implemented — scheduled for Module 5, along
   with the richer story fields §7 asks for: multiple before/after photos, thank-you message, institution
   logo/name on the story card.)*

### Module 3 — Country Expansion + Selector UX: COMPLETE

Covers master-prompt §2 (CPLP countries), §3 (Coming Soon selector), §4 (GPS prompt — already matched the
3-option spec, no change needed), §5 (dev country simulator), §6 (Home Active Country banner). Donor-facing
only (Web + `mobile-donor`) — Active Country is a donor concept; an institution's country is fixed at
registration (§13), not a personal toggle, so the Institution apps were correctly left untouched here.

**What changed:**
- `Geo_Regions` now has all 9 CPLP countries in the real production Sheet: Angola (`Active=TRUE`, unchanged)
  plus Portugal, Brasil, Moçambique, Cabo Verde (already existed) and newly added Guiné-Bissau, São Tomé e
  Príncipe, Timor-Leste, Guiné Equatorial (all `Active=FALSE`, ready to launch by flipping one flag — pure
  data, zero code change, exactly Module 1's original design intent).
- New `GET /geo-regions/all-countries` endpoint (`listAllCountries()` in `geo-regions.ts`) returning every
  Country-level row regardless of `Active`. The existing `GET /geo-regions/countries` (active-only) is
  untouched and still backs onboarding, Home Country, and institution registration — those must only ever
  offer a real, currently-launched country. The two endpoints exist for deliberately different purposes;
  using the wrong one anywhere would be a real bug, not a style choice.
- Settings' "País ativo" selector (Web + mobile-donor) now shows all 9 countries: active ones selectable
  normally, inactive ones labeled "— Brevemente" and disabled (native `<option disabled>` on web,
  `Picker.Item enabled={false}` on mobile) rather than hidden — no redesign needed the day one launches.
  "País de origem" (Home Country) deliberately still shows active-only.
- Home screen (Web + mobile-donor) now shows a "🌍 País ativo" card with the resolved country name.
- Developer-only "Opções de programador" section in Settings (Web: gated on
  `process.env.NODE_ENV !== 'production'`; mobile: gated on `__DEV__`) with buttons for the 5 countries
  `geo-detect.ts` can actually recognize from coordinates (Angola/Portugal/Brasil/Moçambique/Cabo Verde).
  Clicking one publishes through a tiny pub-sub (`lib/dev-country-simulator.ts`) that `SwitchCountryPrompt`
  subscribes to — exercises the exact same code path as real GPS, no VPN or fake-location app needed, and
  the publish side never renders outside a dev build.
- **A real bug found and fixed during verification, not just this module's new code:** `SwitchCountryPrompt`
  was only mounted inside the Home screen/tab, so GPS detection (and the new dev simulator) silently did
  nothing from any other screen. Moved it to `AppShell` (web, wraps every authenticated page) and to
  `RootNavigator` (mobile, sibling to the tab navigator) so it's present for the whole authenticated session
  regardless of which tab loads first — a correctness fix, not just a dev-tool fix.
- **A second pre-existing gap fixed in the same component:** `switchNow()`/`neverAskAgain()` had no error
  handling — a failed API call left the modal silently stuck with no feedback. Added try/catch and an inline
  error banner on both platforms (Minor fix, applied per `DEVELOPMENT_RULES.md`'s "implement automatically"
  guidance for this class of change).

**Verified:** `npm run typecheck` and `npm run lint` clean across all 7 workspaces. Live browser walkthrough
(Web): fresh sign-up → onboarding (unaffected, still active-only) → Home (banner renders) → Settings
(confirmed all 9 countries present via the accessibility tree, 8 correctly marked "— Brevemente") → used the
dev simulator to trigger a real "Portugal detected" modal end-to-end (network trace confirmed the exact
expected API calls) → confirmed the fix for the AppShell-mounting bug by exercising it from the Settings
route directly. Server-side validation double-checked by deliberately feeding a fake country ID through the
switch flow — correctly rejected with `400`, confirming the backend remains the final authority regardless
of client state. Test account (Firebase user + Sheets row) deleted afterward. Mobile (`mobile-donor`) changes
mirror the verified web implementation line-for-line and typecheck clean, but were not exercised live in a
simulator this pass — recommended before moving on, per `DEVELOPMENT_RULES.md` §12.

**Not done in this module (scheduled for later modules per the breakdown above):** Active-Country filtering
audit across Success Stories/Notifications/future Search-Maps-Statistics (Module 4), Success Stories v2 +
Admin approval (Module 5), donation short codes (Module 6), institution logos everywhere (Module 7),
corporate secure invitations (Module 8), corporate dashboard (Module 9).

### Modules 4–9: not yet started
Sequenced next per the breakdown above. Module 4 should start only after the stakeholder has personally
tested Module 3 (Web confirmed by Claude this session; iOS/Android and final stakeholder sign-off still
outstanding) per `DEVELOPMENT_RULES.md` §12.

---

## Next Steps

1. Stakeholder reviews `PHASE3_ARCHITECTURE_REVIEW.md` and approves/adjusts which Medium/Major items to
   implement and in what order (the report proposes a 5-phase roadmap as a starting point, not a mandate).
2. Implement approved items in the agreed order, updating this file after each phase closes.
3. Only after Phase 3a (pre-launch hardening) is implemented and approved should a production launch be
   considered ready per this review's own findings.
4. Admin Panel redesign begins only after Phase 3 is fully approved (per explicit instruction).

---

## Key File Locations

- `DEVELOPMENT_RULES.md` — binding development constraints (read before any architectural change)
- `MASTER_SPECIFICATION.md` — complete business requirements, single source of truth for business logic
- `apps/mobile-donor/`, `apps/mobile-institution/` — mobile app source
- `apps/web/`, `apps/institution/` — web app source
- `apps/api/` — REST API + Google Sheets integration
