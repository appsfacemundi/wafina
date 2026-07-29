# WAFINA — Phase 3 Architecture & Business Logic Review

**Date:** 2026-07-29
**Scope:** Full platform — Donor (Web/iOS/Android), Institution (Web/iOS/Android), API, Google Sheets database. Admin Panel excluded from redesign scope per instruction, but referenced throughout since it is the other half of every workflow.
**Method:** Full re-read of `MASTER_SPECIFICATION.md` (all 32 sections) and `DEVELOPMENT_RULES.md`, five parallel deep-research passes across the backend/database, notification system, and UX of all four client apps, plus direct verification of every headline claim against the actual source (file:line references throughout the underlying research; this document summarizes and classifies). Every finding below is grounded in code that exists today, not speculation.

---

## 1. Executive Summary

Wafina's Donor and Institution apps are **functionally real and correctly verified at the workflow level** — the Android/iOS/Web verification pass completed just before this review manually walked all six app×platform combinations end-to-end with real accounts, and the core donation lifecycle (submit → claim → deliver → dispute) is solid, well-validated, and matches the specification closely. Authentication is genuinely well-built: role is always re-resolved server-side from the Users sheet, never trusted from the client, and institution verification is checked directly rather than through a cache that could drift — this is the kind of security fundamental that's easy to get wrong and wasn't.

That said, this review surfaces a small number of **systemic gaps that matter more than their individual severity suggests**, because they sit at the seam between the new production apps and the AppSheet Admin that remains permanently in place:

1. **The Admin side of the platform is invisible to the new apps.** Institution verification, dispute resolution, and change-request resolution all happen exclusively in AppSheet, by design — but nothing bridges that back to the Donor/Institution apps. Concretely: **an institution that gets approved today has no way to find out except repeatedly closing and reopening the app.** No push, no email, no polling, no in-app signal of any kind. Of the 7 notification events the spec defines, only 2 (donation claimed, donation delivered — both Donor-facing) are actually wired. The Institution app's entire Notifications tab is functionally always empty in production today.
2. **The platform has not yet been load-shaped.** Every Google Sheets read is a full-tab scan with no caching, and the Institutions browse screen has a genuine N+1 pattern — each institution's "items received" total triggers a fresh full read of the entire Donations tab. At Angola-launch scale this is invisible; it will not stay invisible.
3. **Multi-country is not yet a data concept**, despite being the platform's stated long-term direction. `Users.Country` is collected but used nowhere; Institutions and Donations have no country field at all. Today, a donor anywhere would see every verified institution worldwide with no geographic scoping.
4. **Zero automated tests exist**, despite `MASTER_SPECIFICATION.md` Section 31 explicitly requiring unit, integration, and data-integrity tests. The only correctness evidence today is the (very thorough) manual verification pass.
5. **No accessibility scaffolding and no i18n abstraction exist anywhere**, despite `DEVELOPMENT_RULES.md` explicitly requiring externalized, i18n-ready strings from day one.

None of this is sloppy work — the codebase is unusually honest with itself: nearly every gap found in this review was *already flagged in an in-code comment* by whoever built it ("known V1 limitation," "TODO(Module 3)," "spec gap"). That engineering discipline made this review faster and more trustworthy, and it means the team already knows where the soft spots are. This report turns that into a prioritized, classified plan.

**Bottom line:** ready for a controlled Angola pilot with a short pre-launch hardening pass (Section 9). Not yet close to "serving millions across multiple countries" — that gap is real, well-understood, and addressed in the roadmap below, but it is a genuine second phase of work, not a tweak.

---

## 2. Current Strengths

- **Server-side trust boundary is correctly drawn.** `requireAuth` re-resolves Role/Verified from the Users sheet on every request from the Firebase token alone; the client's own claims are never trusted, including at signup. `requireVerified` checks `Institutions.Verified` directly rather than a cached copy, specifically because Admin edits the sheet directly and nothing keeps a cached flag in sync — a subtle correctness call that was made deliberately, not by accident.
- **Business-logic validation matches the spec closely**: donation quantity bounds, non-zero-coordinate location checks, dispute restricted to Claimed/Delivered donations only, dispute-raiser must be the institution that actually claimed it, field-locking enforced by simply never exposing an institution-update endpoint (a robust way to enforce a lock — impossible to bypass by forgetting a check).
- **Clean single-chokepoint data-access layer.** Every service goes through exactly four primitives in `config/sheets.ts` (`getRows`/`appendRow`/`updateRow`/`findRow`). This is a genuine, already-in-place strength for the future PostgreSQL migration (Section 10) — the moment to reimplement those four functions against SQL, every service above them changes nothing.
- **The manual cross-platform verification pass was real and thorough** — six app×platform combinations, real Firebase accounts, real Sheet data, five real bugs found and fixed along the way (safe-area overlap, tab-label truncation, an Android-only icon rendering bug, a genuine registration dead-end bug, a disputes-list layout overflow).
- **The design system (`packages/ui`, mobile theme tokens) is coherent and shared** — consistent spacing/color/typography scale across the web apps via `packages/ui`, and a matching (if separately-maintained) token set on mobile.
- **Multi-country expansion does not require a new application.** The architecture — one API, shared `packages/shared` types, per-role apps — already structurally supports adding countries once the data model and i18n gaps (Sections 8 and 9) are closed. This is worth stating plainly: the hard part is data and language, not rebuilding anything.

---

## 3. Weaknesses by Review Dimension

### 3.1 Business Logic
The donation/verification/dispute/corporate-account lifecycles are implemented correctly where they touch the API — but four of the seven spec'd approval/notification workflows terminate in AppSheet with no path back to the app (see Section 3.6). Institution-deletion cascade (an explicitly "confirmed requirement," spec §24) does not exist in code at all. Corporate "dashboard" is a stats-grid bolted onto the existing donations list, not a distinct view, and mixes every team member's donations into one unattributed list.

### 3.2 User Experience
Core flows are usable and visually consistent, but: zero accessibility props anywhere (confirmed by exhaustive grep across all four client apps), no dynamic-type/font-scaling consideration, no shared data-fetching/cache layer (every screen fetches independently on mount only — no pull-to-refresh, no focus-refetch anywhere), inconsistent error-handling (some screens surface the real backend error, others show one fixed string or nothing at all), and several spec'd screens were never built (Success Stories/Impact Gallery, language-selection onboarding, institution detail view, "My Change Requests" history).

### 3.3 Database Architecture
Sound for V1 scale and appropriately simple per `DEVELOPMENT_RULES.md`. Gaps: no Country field on Institutions/Donations, `Total_Items_Received` recomputed from a full table scan on every read rather than maintained incrementally, all uniqueness constraints are check-then-write races (Sheets has no native constraints — acknowledged in the spec itself), and `MASTER_SPECIFICATION.md` Section 26 still documents a since-superseded "new production DB + real-time sync to Sheets" architecture that contradicts the current, correctly-simpler `DEVELOPMENT_RULES.md` approach.

### 3.4 Security
Authentication/authorization fundamentals are strong (Section 2). Gaps: zero audit logging despite Admin's unrestricted direct-edit authority over all data; donation photo upload trusts the client-declared MIME type with no content verification; the corporate "invite code" is literally the permanent, non-rotatable account primary key; no maximum length on dispute descriptions.

### 3.5 Performance
No caching, batching, pagination, or retry/backoff anywhere in the Sheets access layer — every list operation is a full-tab read, and `requireAuth`/`requireVerified` alone cost two full-tab scans before any actual work happens on every authenticated Institution request. The Institutions browse screen has a genuine N+1: listing N verified institutions performs 1 + N full reads of the *entire* Donations tab.

### 3.6 Notifications
Architecturally reasonable (clear data model, ownership-checked mark-as-read, deep-link field present) but badly underpowered in practice: **only 2 of the 7 spec'd events are wired** (both Donor-facing: claimed, delivered). Institution-approved, Institution-rejected, Dispute-resolved, and Change-Request-resolved all have *no triggering code path at all*, because the actions that would trigger them happen entirely in AppSheet. No email integration exists despite two events being spec'd as In-app + Email. "Deep-linking" is currently fake — every notification, in every app, navigates to the same fixed generic list screen regardless of content.

### 3.7 Reports & Analytics
The report *data* is well-specified (§20/21) and mostly derivable today, but there is no reporting UI or API anywhere beyond three raw stat tiles on the Institution Home screen and a repurposed donations list for Corporate donors. Nothing for Admin, and nothing public-facing for future government/NGO partners.

### 3.8 AI Opportunities
Not yet explored at all — greenfield. See Section 7.

### 3.9 Multi-Country Architecture
Not yet a data concept anywhere in the system (Section 1, item 3). This is the single largest gap relative to the platform's stated long-term ambition.

### 3.10 Future Database Migration
Well-positioned structurally (Section 2), not yet acted on — appropriately, per `DEVELOPMENT_RULES.md` Rule 13, which explicitly says not to design V1 around it.

---

## 4. Top Risks (ranked)

1. **Institution trust/onboarding goes silent.** A newly-approved institution has no way to discover this except manual, repeated app-reopening. For a platform whose credibility depends on institutions feeling looked-after, a days-long silent gap after approval is a real reputational risk, not just a UX nit.
2. **Performance cliff, not degradation.** Because the bottleneck is a full-tab scan multiplied per row (N+1), the Institutions screen doesn't slow down gracefully as data grows — it gets abruptly much worse, and Google Sheets' API quotas mean this can turn into outright request failures, not just latency.
3. **Silent data-integrity drift.** No uniqueness enforcement at the data layer (Users.Email, Institution_ID) plus no server-side controlled-list validation for Item_Type/Condition/Institution.Type means the exact class of bug the spec's own Appendix documents from the reference implementation (duplicate keys, inconsistent enum values) can recur in production with nothing to catch it.
4. **No safety net for regressions.** With zero automated tests, every future change relies entirely on manual re-verification to catch breakage — expensive and easy to skip under time pressure as the codebase grows.
5. **Multi-country expansion, if started today, would require retrofitting core tables** (Institutions, Donations) rather than just turning a feature on — better to close this gap deliberately before expansion pressure forces it under time pressure.

---

## 5. Opportunities

- The clean Sheets-access chokepoint (Section 2) makes the single highest-leverage performance fix — an in-memory caching layer — a contained, low-risk change with outsized impact (Section 6, PERF-1/2).
- AppSheet's own "Bots/Automations" capability (already anticipated in spec §8.5.4) is a natural, low-effort bridge for the Admin-action notification gap — no need to build a new admin surface from scratch.
- The donation-photo-upload pattern is already fully built and proven; extending it to institution logos (Section 6, UX-4) is nearly a copy-paste, not new engineering.
- The "My Disputes" pattern (already built, works well) is a direct template for the missing "My Change Requests" view (Section 6, UX-5).
- Multi-country expansion is genuinely additive work on top of the current architecture, not a rebuild (Section 2) — a real strength worth leaning into rather than something to fear.

---

## 6. Recommended Improvements

Each item is tagged **[MINOR]**, **[MEDIUM]**, or **[MAJOR]**. Minor items were implemented automatically this session (see Section 6.0). Medium/Major items are described with impact and database implications, and require your approval before implementation — none of them have been implemented yet.

### 6.0 Minor — implemented this session

| # | Change | Why |
|---|---|---|
| M-1 | Removed hardcoded `'pt-PT'` locale from all 6 date-formatting call sites (both mobile apps, both web apps) — now uses the device/browser's own default locale | `pt-PT` (Portugal) was hardcoded even though Angola is the launch market; using the runtime default is correct today and for every future market without any further change |
| M-2 | Deleted `apps/api/scripts/tmp-seed-donation.ts` | Dead script using column names (`Photo_URL`, `Location_lat`, `Claimed_By`, `Date_Created`) that no longer match the actual schema — would error if ever run |
| M-3 | Fixed `autoCapitalize="none"` being forced on proper-noun name fields (Donor Settings "Nome", Donor Onboarding "Nome", Institution Register "Nome da instituição") | Small real UX friction — typing your own name shouldn't fight autocapitalization. No component change needed; the `Input` component already supported per-field override, it just wasn't being used |

Verified via `npm run typecheck` and `npm run lint` across all workspaces — clean.

**Queued but not yet applied** (genuinely Minor severity, but touch enough files that I'm listing them rather than silently expanding this session's diff further — say the word and I'll do any/all of these next):
- Consolidate the hand-rolled error-banner styling duplicated across 6 list screens (`MyDonationsScreen`, `InstitutionsScreen`, `NotificationsScreen` on Donor; `AvailableDonationsScreen`, `ClaimedByMeScreen`, `DisputesListScreen` on Institution) into the existing shared `ErrorBanner` component.
- Add a maximum length cap on `Dispute.Issue_Description` (currently minimum-only).
- Standardize error-message handling so every screen surfaces the real `ApiError.message` instead of a fixed generic string (`NotificationsScreen` on both apps, `HomeScreen` on Institution which currently swallows fetch errors with zero user feedback).

### 6.1 Business Logic

**BL-1 — Bridge Admin actions back into the app. [MAJOR]**
*Finding:* Institution verification, dispute resolution, and change-request resolution happen exclusively in AppSheet. There is no code path — none — that fires when Admin approves an institution, resolves a dispute, or resolves a change request. Not "unwired," but genuinely nonexistent: the corresponding service functions don't exist in the API at all.
*Impact:* 4 of the 7 spec'd notification events can never fire under the current architecture, regardless of any notification-code fix. The Institution app's Notifications tab is permanently empty in production. Institutions have no way to learn their status changed short of repeatedly reopening the app.
*Recommendation:* Use AppSheet's own Bots/Automations (already anticipated in spec §8.5.4) to call a small set of new, Admin-only API endpoints when Admin acts (approve/reject institution, resolve dispute, resolve change request) — routing the write through the API means it can trigger a notification exactly like `claimDonation`/`confirmDelivery` already do. This keeps Admin on AppSheet exactly as required, adds no new UI, and reuses infrastructure that's already planned.
*Database implications:* None beyond the existing `Notifications` tab. New Admin-only routes and a corresponding AppSheet Bot per action.

**BL-2 — Implement the institution-deletion cascade. [MEDIUM]**
*Finding:* Spec §24 explicitly confirms this as a required automation (revert affected Donations to Pending, clear `Claimed_By_Institution_ID`), but no delete function exists for Institutions anywhere in the API.
*Impact:* Low-frequency event, but if it happens today, donations claimed by a deleted institution are silently orphaned rather than reverted, contradicting a confirmed spec requirement.
*Recommendation:* Add the delete path with the cascade logic. Small, contained change.
*Database implications:* None — uses existing fields.

**BL-3 — Give Corporate donations per-member attribution. [MEDIUM]**
*Finding:* The "company dashboard" (spec §11.4.3) is currently the existing personal donations list with an extra stats-grid, showing every team member's donations mixed into one flat, unattributed list.
*Impact:* Functionally satisfies the spec's letter but not clearly its intent — a company can't tell which team member donated what.
*Recommendation:* Add the submitting user's name/label to each row when viewing as a corporate account. Small, additive UI change; no backend change needed (the data is already there, just not surfaced).

### 6.2 User Experience

**UX-1 — Accessibility pass. [MAJOR]**
*Finding:* Zero `accessibilityLabel`/`accessibilityRole` props anywhere across all four client apps (confirmed by exhaustive grep, not sampling). No dynamic-type handling, no verified touch-target minimums.
*Impact:* Excludes users relying on screen readers or OS text-scaling entirely — a real gap for a platform aiming to serve "millions" inclusively, and a legal/App-Store-review consideration in some target markets.
*Recommendation:* Start with the highest-traffic interactive surfaces (buttons, form inputs, notification rows, tab bar) and expand outward. Test with VoiceOver/TalkBack on the core donate/claim flows before wider rollout.
*Database implications:* None.

**UX-2 — Real per-notification deep-linking. [MEDIUM]**
*Finding:* Every notification, in every app, on every platform, navigates to the same fixed generic screen regardless of what it's actually about — contradicting the spec's own explicit requirement (§19, §10.3.3).
*Recommendation:* Sequence together with BL-1 — as new notification types get wired, give each a real target screen + params using the nested-stack pattern already proven in the Institution app's Disputes tab.
*Database implications:* None — `Donation_ID` is already stored on notifications; needs a generalized "what kind of record" field to also support institution/dispute/change-request-linked notifications (small, additive schema change).

**UX-3 — Shared data-fetching/cache layer. [MAJOR]**
*Finding:* No React Query/SWR/shared-context caching anywhere — every screen fetches independently on mount only, with no pull-to-refresh and no refetch-on-focus anywhere in either mobile app.
*Impact:* This is the direct root cause of `VerificationStatusScreen` never detecting approval without a forced sign-out/in — the same bug class already fixed once for registration, recurring one step later in the same flow. It also means the whole app is "stale until you leave and come back," everywhere.
*Recommendation:* Introduce a standard, well-trodden data layer (e.g., `@tanstack/react-query` — works identically across React Native and Next.js) so screens refetch on focus/reconnect and support pull-to-refresh cheaply. Touches most screens (large blast radius, hence Major), but the pattern itself is low-risk and extremely well-established.
*Database implications:* None.

**UX-4 — Institution logo upload. [MEDIUM]**
*Finding:* No logo upload exists anywhere — not in `RegisterScreen`'s UI, not in the institution-creation API — despite `Institution.Logo` being part of the schema and the Donor-side browse screen already being ready to display one.
*Impact:* Institutions can never have a visible logo, undermining the trust/legitimacy signaling that matters on a verification-gated platform.
*Recommendation:* Extend `RegisterScreen` with the exact photo-picker pattern already built and proven for donation photos; add `Logo` to `CreateInstitutionInput` and wire it to the existing Drive-upload code path. Low implementation risk — the pattern already works elsewhere in the same codebase.
*Database implications:* None — `Logo` column already exists, just unused.

**UX-5 — "My Change Requests" history view. [MEDIUM]**
*Finding:* An institution can submit a change request but then has no way, anywhere, to see whether Admin acted on it — no list, no status, and (per BL-1) no notification either.
*Recommendation:* Add `GET /change-requests/mine` + a list screen, mirroring the existing "My Disputes" pattern exactly.
*Database implications:* None.

**UX-6 — Institution detail view for Donors. [MEDIUM]**
*Finding:* The Donor-side Institutions browse list is non-interactive — donors can see institution names/types in a list but can never open a single institution's full profile.
*Recommendation:* Add a simple detail screen (name, type, needs list, logo once UX-4 lands, total items received) reached by tapping a list row.
*Database implications:* None — `GET /institutions` already returns everything needed; may want a `GET /institutions/:id` for a public-safe single-record fetch.

### 6.3 Database Architecture

**DB-1 — Reconcile `MASTER_SPECIFICATION.md` Section 26 with the actual (correct) architecture. [MEDIUM]**
*Finding:* Section 26 still documents a "new production database (PostgreSQL) + real-time sync to Google Sheets" plan that `DEVELOPMENT_RULES.md` explicitly and correctly superseded (Sheets is the single production database, no second datastore, no sync layer). The current implementation correctly follows the newer, simpler rule — but the designated single source of truth still describes the old plan.
*Impact:* Low functional risk today (the code is right, the doc is stale), but real risk for anyone who reads the spec fresh and builds against the wrong architecture later.
*Recommendation:* Formally amend Section 26. I have not edited `MASTER_SPECIFICATION.md` myself — per `DEVELOPMENT_RULES.md` Rule 8, changes to that document require your explicit approval even when the change is just a correction. Say the word and I'll draft the replacement section for review.
*Database implications:* Documentation only.

**DB-2 — Maintain `Total_Items_Received` incrementally instead of recomputing it. [MEDIUM]**
*Finding:* Currently recomputed by summing the entire Donations tab on every single read of any institution — this is the root cause of the N+1 pattern in PERF-2 below, not just a symptom of it.
*Recommendation:* Increment a stored counter inside `confirmDelivery` (which already writes that donation's row) instead of recomputing from scratch elsewhere. Fixes the performance problem by construction rather than caching around it.
*Database implications:* `Total_Items_Received` becomes a real stored column instead of a derived value — small, safe migration (backfill once from the current computed value, then switch the write path).

**DB-3 — Verify the production Google Sheet actually has the newer tabs/columns the code assumes. [MEDIUM]**
*Finding:* Multiple in-code comments flag `Corporate_Accounts`, `Change_Requests`, and `Institutions.Locked_Fields` as columns/tabs that "don't exist in the live sheet yet" as of when they were written.
*Recommendation:* Pre-launch checklist item — confirm directly against the real production spreadsheet (not the code's assumptions) that every tab/column the API expects actually exists before go-live.
*Database implications:* Verification task, not a code change.

### 6.4 Security

**SEC-1 — Add audit logging for Admin's direct data edits. [MEDIUM]**
*Finding:* Admin has full, unrestricted, direct edit authority over all Users/Donations/Institutions/Disputes data (spec §4.2.3), and there is zero logging of who changed what, when, anywhere in the system.
*Impact:* No accountability trail if data is altered incorrectly (or maliciously), which matters increasingly as the platform seeks government/NGO partner trust (Section 7).
*Recommendation:* Add an `Audit_Log` tab plus write-through logging in every API mutation. This can only cover API-driven writes — Admin's direct AppSheet edits would need a complementary AppSheet-side change-log automation to be fully covered.
*Database implications:* New tab.

**SEC-2 — Harden the corporate "invite code." [MEDIUM]**
*Finding:* The invite code a team member enters to join a corporate account is literally the `Corporate_Account_ID` primary key — permanent, never expires, never rotates.
*Impact:* Anyone who ever sees this value (a forwarded email, a screenshot, a URL) can join the corporate account indefinitely, with no revocation short of Admin manually provisioning a brand-new account.
*Recommendation:* Add a dedicated, rotatable `Invite_Code` column separate from the primary key.
*Database implications:* One new column on `Corporate_Accounts`; non-breaking, additive.

**SEC-3 — Verify uploaded file content, not just the declared MIME type. [MEDIUM]**
*Finding:* Donation photo upload trusts the client-declared `Content-Type` header with no magic-byte/content verification.
*Recommendation:* Add a lightweight content-sniffing check before accepting an upload.
*Database implications:* None.

### 6.5 Performance & Scalability

**PERF-1/2 — Add a caching layer in front of the Google Sheets access functions. [MAJOR]**
*Finding:* `getRows`/`findRow`/`updateRow` (`config/sheets.ts`) do a full-tab read on every single call, with no cache, no pagination, no retry/backoff. `requireAuth` alone costs one full-tab scan of Users on every authenticated request; `requireVerified` costs a second, of Institutions. Listing N verified institutions costs 1 + N full reads of the entire Donations tab, because `Total_Items_Received` is recomputed from scratch per institution (see DB-2).
*Impact:* This is the single highest-leverage technical fix in this entire review. At Angola-launch scale it's invisible. At a few hundred institutions and a few thousand donations, the Institutions screen alone could mean tens of thousands of redundant row-reads per page load, and Google Sheets' API has real, well-documented per-minute quotas — this doesn't degrade gracefully, it starts failing outright.
*Recommendation:* Add a short-TTL (15–30s), invalidate-on-write, in-memory cache in front of `getRows`, since every service already funnels through that one chokepoint (Section 2's clean architecture makes this a contained change, not a scattered one). Combined with DB-2 (stop recomputing `Total_Items_Received`), this collapses the N+1 pattern entirely rather than just papering over it.
*Impact classification note:* The code change itself is small and contained, but it sits underneath every single API request, so I'm classifying it Major by blast-radius/risk rather than by line count — this needs your sign-off before I touch shared infrastructure that everything else depends on.
*Database implications:* None — purely an in-process caching layer, no schema change.

**PERF-3 — Document and monitor the claim-race condition, don't let it get forgotten. [MEDIUM]**
*Finding:* `claimDonation` has a real, already-acknowledged (in the code's own comments) check-then-write race: two institutions claiming the same donation at the same moment could both succeed, since Sheets has no transactions.
*Recommendation:* Acceptable as a documented V1 tradeoff at current expected volume (this was an explicit, deliberate call by whoever built it, not an oversight) — but worth tracking explicitly rather than letting it silently become "the way it's always worked" as volume grows. A simple serialized-write lock keyed by donation ID would close it if/when it becomes a real problem.
*Database implications:* None.

### 6.6 Notifications

See BL-1 (the root cause) and UX-2 (deep-linking). Once BL-1 lands, the remaining work is mechanical: wire the 4 currently-missing events through the same `createNotification` call the 2 working ones already use, and add the email channel for the two events spec'd as In-app + Email — no email-sending integration exists at all today (**[MEDIUM]**, needs a provider choice — e.g., a transactional email API — before implementation).

### 6.7 Reports & Analytics

**RA-1 — Build the reporting layer the spec's data already supports. [MAJOR, staged]**
*Finding:* Report *data* is well-specified (§20/21) and mostly derivable today, but there is no reporting UI/API anywhere beyond three raw stat tiles.
*Recommendation (staged, not launch-blocking):*
- Donor: a simple lifetime-impact view (items donated, by category).
- Institution: extend the existing Home tiles with a received-by-month/by-category trend once there's enough volume for a trend to mean anything.
- Corporate: promote the current bolted-on stats-grid into its own screen with per-member attribution (ties to BL-3).
- Future government/NGO partners: aggregate, anonymized regional/national impact summaries — natural pairing with the not-yet-built Success Stories feature (both are public-trust-building content, worth designing together).
*Database implications:* None beyond Section 6.3's Country field (Section 6.9) once country-level breakdowns are wanted.

### 6.8 AI Opportunities

Evaluated against `DEVELOPMENT_RULES.md` Rule 10 ("only introduce new technology when there is a clear, current business need") — most of the examples you listed are better solved simply, for now:

- **AI-1 [MEDIUM, recommended] Donation-photo categorization assist.** A lightweight image-classification pass at photo-selection time could pre-fill/suggest Item_Type, speeding up the Donate form and improving data consistency — which also happens to be exactly the data-integrity gap flagged in Section 6.4 (Item_Type currently has no server-side controlled-list validation). Solving both together is efficient: pair an AI-assisted suggestion with a real controlled list, non-blocking, user can always override.
- **AI-2 [not recommended yet] Institution recommendations for donors.** The spec itself already correctly defers this as future-phase (§19, §25) — the current first-come-first-claimed model works fine at launch volume, and recommendations have a cold-start problem without real usage data yet. Revisit later, not now.
- **AI-3 [MEDIUM, recommended] Duplicate/fraud flagging for Admin review.** Given zero DB-level uniqueness enforcement (Section 6.4) and a documented history of exactly this bug class in the reference implementation's data, a lightweight "flagged for review" queue (near-duplicate institution registrations by name+location, implausible donation volume in a short window) is a good fit — framed as a human-in-the-loop signal for Admin, never an auto-block, which suits an NGO trust context.
- **AI-4/AI-5 [low priority, sequence-dependent] Content moderation and success-story generation.** Both are genuinely premature until the Success Stories feature exists at all — they're dependencies of that feature, not standalone initiatives.
- **AI-6 [not recommended as AI] "Administrative recommendations."** The real near-term need here — reminding Admin about institutions pending verification too long — is already explicitly recommended in the spec (§24) as a plain scheduled automation. Solve it simply first; only reach for AI if a rule-based reminder proves insufficient.

**Recommended starting point if you want to pursue any of this: AI-1 and AI-3.** Both have a genuine near-term value-to-complexity ratio; the rest should wait for their prerequisites.

### 6.9 Multi-Country Architecture

**MC-1 — Add Country to the data model. [MAJOR]**
*Finding:* `Users.Country` exists and is required at onboarding, but is used by literally nothing today — no filtering, no scoping. `Institutions` and `Donations` have no country field at all.
*Recommendation:* Add `Institutions.Country` as a new explicit field (an institution's actual operating country matters more than its registrant's self-declared home country, so it shouldn't just inherit from `Users.Country`). For `Donations`, avoid a new column entirely — derive Country via the existing `Donor_ID → Users.Country` relationship, which is simpler and avoids a second copy of the same fact going stale (matches `DEVELOPMENT_RULES.md` Rule 10's simplicity-first ordering). Then default `listVerifiedInstitutions`/`listAvailableDonations` to filter by the requesting user's own country.
*Database implications:* One new column (`Institutions.Country`); everything else is a query-level filter, not a schema change.

**MC-2 — GPS-assisted "prompt to switch," never automatic. [MEDIUM]**
*Recommendation:* On app open, compare the device's current locale/coarse-GPS-inferred country against the account's stored `Country`; if they differ, show a dismissible, non-blocking prompt ("Detectámos que está em Portugal — mudar de mercado?") — exactly matching your explicit requirement that this never happen silently. Start with free, on-device locale/GPS-bounding-box inference rather than a paid reverse-geocoding API; only add that dependency if accuracy proves insufficient in practice.
*Database implications:* None.

**MC-3 — Country-scoped Admin. [MEDIUM, deferred by design]**
*Finding:* Admin is entirely AppSheet-based today, with a single hardcoded email — already flagged in the spec itself as a reference-implementation-only limitation.
*Recommendation:* Explicitly defer real country-scoped Admin roles to the future Admin Panel rebuild (out of scope for this review per your instruction) — but design that rebuild's role model with country-scoping in mind from day one, rather than bolting it on afterward.

**MC-4 — Country-filtered reports. [MEDIUM, cheap once MC-1 lands]**
Once Country exists on Institutions/Donations, every report in §20 gains Country as a free grouping/filter dimension — no new architecture needed.

**MC-5 — Multi-language support. [MAJOR]**
*Finding:* Zero i18n scaffolding anywhere, confirmed independently across all four client apps — every user-facing string, in every screen, is a hardcoded Portuguese literal with no translation-key indirection.
*Impact:* This is a real, substantial, dedicated body of work — hundreds of strings across roughly 35 screens/pages — not something to fold into a general cleanup pass.
*Recommendation:* Treat as its own project (matching `DEVELOPMENT_RULES.md` Rule 12's one-module-at-a-time philosophy), using a standard library per platform (`i18next`/`react-i18next` for the mobile apps, `next-intl` for the web apps), plus the language-selection onboarding step and Settings-editable preference the spec already calls for but that don't exist yet.

**MC-6 — Confirm expansion needs no new app. [Existing strength, no action needed]**
Once MC-1 and MC-5 land, expanding to Portugal/Brazil/Mozambique/Cape Verde is additive configuration and content, not new engineering — worth stating plainly since it's good news, not a gap.

### 6.10 Future Database Migration Readiness

No action needed now — this section is about *not making things worse*, per your explicit instruction and `DEVELOPMENT_RULES.md` Rule 13 (don't design V1 around a future migration).

- **Genuinely migration-friendly today:** the single `config/sheets.ts` chokepoint (Section 2), and the fact that sheet-native encodings (`TRUE`/`FALSE` strings, combined `lat,lng` strings, ISO date strings) all live in one file (`sheet-values.ts`), not scattered through services.
- **Worth doing at migration time, not before:** treat "migrate to PostgreSQL" and "finally enforce real uniqueness/foreign-key constraints" as the same project — Sheets structurally cannot do this today (the spec itself acknowledges this), so the migration is the natural moment to fix it properly rather than trying to simulate constraints in application code beforehand.
- **Worth preparing as a document, not code:** when that migration is scheduled, generate a formal schema/ERD from spec §5–7 plus the Appendix's known-issues list as an explicit data-cleaning checklist to run against live Sheet data before cutover — this is planning, not a reason to touch anything now.

---

## 7. Priority Matrix

| | **Low effort** | **Medium effort** | **High effort** |
|---|---|---|---|
| **High impact** | UX-4 (logo upload)¹, UX-5 (change-request view)¹, BL-2 (deletion cascade) | BL-1 (Admin bridge), MC-1 (Country data model), DB-2 (incremental counter) | PERF-1/2 (caching layer)², UX-3 (data/cache layer), UX-1 (accessibility) |
| **Medium impact** | UX-6 (institution detail), SEC-3 (upload verification) | SEC-1 (audit log), SEC-2 (invite code), MC-2 (GPS prompt), UX-2 (deep-linking) | RA-1 (dashboards), MC-5 (i18n) |
| **Lower impact** | Queued Minor polish (Section 6.0) | DB-3 (production-sheet verification) | MC-3 (country-scoped Admin — deferred by design) |

¹ Both directly reuse an already-proven pattern elsewhere in the codebase — genuinely low-risk despite touching real code.
² Small code change, but sits underneath every API request — classified by blast-radius, not line count.

---

## 8. Implementation Roadmap

This is a sequencing proposal, not a commitment — every Medium/Major item still needs your explicit go-ahead before I touch it.

**Phase 3a — Pre-launch hardening (do before or immediately alongside the Angola pilot):**
BL-1 (Admin bridge, at minimum for institution verification — the highest-trust-impact gap), PERF-1/2 (caching layer), DB-2 (incremental counter), BL-2 (deletion cascade), UX-4 (logo upload), UX-5 (change-request view), DB-3 (verify production sheet), remaining queued Minor polish (Section 6.0).

**Phase 3b — Near-term post-launch hardening:**
UX-3 (shared data/cache layer + pull-to-refresh), UX-1 (accessibility pass), SEC-1/2/3 (audit log, invite code, upload verification), remaining notification wiring (dispute/change-request resolution, building on BL-1's bridge), UX-2 (real deep-linking).

**Phase 4 — Multi-country expansion (dedicated project):**
MC-1 (Country data model), MC-2 (GPS-prompt switching), MC-4 (country-filtered reports), MC-5 (i18n — the largest single item in this whole review), MC-6 (confirm expansion readiness).

**Phase 5 — Growth features:**
RA-1 (dashboards), AI-1 + AI-3 (categorization + fraud-flagging), the Success Stories feature itself, then AI-4/AI-5 once Success Stories exists to depend on.

**Deferred, post-V1 (per `DEVELOPMENT_RULES.md` Rule 13):**
PostgreSQL migration, country-scoped Admin roles (as part of the future Admin Panel rebuild), a real rotatable invite-code system if not done in Phase 3b, push notifications, smart donation-matching (already spec'd as future-phase).

---

## 9. Estimated Impact

Rather than fabricate calendar estimates without real velocity data, here's relative sizing and the business case for each phase:

- **Phase 3a** is small in code volume but high in trust impact — it closes the "institution approved and nobody told them" gap, which is arguably the single most damaging silent failure a verification-gated platform can have.
- **Phase 3b** is where the platform stops being fragile — the caching/data-layer work in particular changes "works when I test it" into "works under real, imperfect usage" (backgrounded apps, flaky connections, users who don't force-refresh).
- **Phase 4** is the largest single investment in this roadmap (i18n alone touches every screen) but is also the direct enabler of the platform's stated long-term goal — this is not optional scope, it's the next real chapter of the project.
- **Phase 5** compounds on a now-stable base — dashboards and AI features are meaningfully cheaper to build well once Phases 3–4 remove the current data-quality and staleness gaps they'd otherwise inherit.

---

## 10. Production Readiness Score

A single number would flatten two very different questions into one misleading answer, so here are both, plus the breakdown behind them.

| Dimension | Score | Basis |
|---|---|---|
| Core business-logic correctness | 80% | Thoroughly manually verified across all 6 platform combinations; real bugs found and fixed; the Admin-bridge gap is the main open hole |
| Security | 70% | Strong auth fundamentals; gaps are real but bounded (audit log, upload verification, invite-code hardening) |
| Database architecture (for current Sheets-based V1) | 65% | Appropriately simple per the dev rules; missing Country field and unenforced constraints are the main gaps |
| User experience (functional) | 55% | Coherent, usable core flows; several spec'd screens unbuilt; inconsistent error handling |
| Notifications | 30% | Solid architecture, only 2 of 7 events actually fire; institutions get none today |
| Performance & scalability | 40% | Fine at test scale; N+1 pattern and zero caching mean this will not hold as data grows |
| Accessibility & i18n | 20% | Effectively unstarted on both fronts |
| Multi-country readiness | 20% | Country is not yet a data concept anywhere; architecture supports it, data model doesn't yet |
| Automated testing / QA | 15% | Zero automated tests exist; only safety net is the manual verification pass |

**For the near-term goal — a controlled Angola pilot per the spec's own phased rollout (§27, §32): ~64%.** The core product works and was genuinely verified; a focused Phase 3a hardening pass closes the gaps that matter most at this scale.

**For the stated long-term goal — a world-class, secure, scalable platform serving millions across multiple countries: ~34%.** This isn't a criticism of the work done so far — it's an accurate statement of how much of that ambition (multi-country, scale, accessibility, testing discipline) is genuinely still ahead, distinct from and larger than what an MVP launch requires.

---

## Appendix A: Research Evidence Trail

This review is grounded in:
- Full read of `MASTER_SPECIFICATION.md` (all 32 sections) and `DEVELOPMENT_RULES.md`.
- Five parallel deep-research passes: backend/database/API (Express routes, services, middleware, Sheets access layer), notification system (every trigger site cross-referenced against the spec's 7-event table), Donor mobile UX (9 screens), Institution mobile UX (11 screens), and both web apps (16 pages across Donor web + Institution web) plus the corporate-account and Success-Stories/i18n feature-gap check.
- Direct, first-hand verification of every headline claim in this document — the N+1 pattern, the Admin-bridge gap, the missing Country field, the zero-test-file confirmation, the auth middleware's trust boundary — was independently re-checked against the actual source, not taken solely on a sub-agent's word.

## Appendix B: What Was Not Changed

Per your explicit instruction, the Admin Panel (AppSheet) was not touched, reviewed for redesign, or scoped for rebuild in this document — it is referenced only where its behavior affects the Donor/Institution apps' workflows. No Medium or Major recommendation above has been implemented; all are awaiting your review and approval.
