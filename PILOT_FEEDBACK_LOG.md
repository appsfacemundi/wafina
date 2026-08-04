# Pilot Feedback Log

## RC1 Exit Criteria

RC1 is only declared **"Launch Ready"** when every one of these is checked:

- [ ] No Blockers
- [ ] All High issues closed and verified
- [ ] Medium issues accepted or fixed
- [ ] Low issues documented for RC1.1 if deferred
- [ ] Google Play compliance complete
- [ ] Apple compliance complete
- [ ] APK/AAB verified
- [ ] Real-device testing completed
- [ ] Pilot Feedback Log fully reviewed
- [ ] Launch Readiness Audit passed

**At that point:** stop development entirely, tag the release in Git, archive this log, and move into
publishing and post-launch support — not continued tweaking.

---

## The 5-phase plan this belongs to

1. **Pilot Polish** (here) — real device testing, batched fixes.
2. **UX Review** — Claude reviews with a designer/engineer lens, still no new features.
3. **Launch Readiness** — Google/Apple reviewer-style audit, no blocking issues.
4. **Publishing** — final AABs, store assets, Play Console submission.
5. **Soft Launch** — 5–10 real people use it unguided; watch where they hesitate.

**Do not skip ahead.** Each phase starts only once the previous one is genuinely done.

## Testing mindset

Test like a first-time donor, first-time institution, or a volunteer who's never seen Wafina before, not
like a developer checking "does it work." Ask: Is it obvious? Is it fast? Would my mother understand this
without instructions?

**Don't only test the happy path.** Intentionally try to break it: cancel an upload mid-way, turn Wi-Fi/
mobile data off, rotate the phone, press Back repeatedly, upload a very large photo or several at once,
leave the app mid-upload, receive a call during a process, kill the app and reopen it.

## Regression Check — every time you install a new APK

Spend 5 minutes on these **before** looking at new fixes. If any of these break, stop and fix the
regression first — don't keep testing new items on top of a broken core flow.

**Donor:** Sign in · Register · Complete profile · Create donation · Upload photos · View donation details
· View "My Donations" · Notifications · Settings · Logout · Delete account

**Institution:** Sign in · View available donations · Claim donation · Schedule pickup · Confirm collection
· Confirm delivery · Create Impact Story · Notifications · Settings · Logout

## Future Enhancements (Post-RC1)

Not regressions — these don't exist yet, so don't test for them as if something broke. A home for ideas
that come up during testing so they don't get lost, without creating noise in the RC1 checklist:

- Edit Donation — backend already supports it (`PATCH /donations/:id` while Pending); no UI exposes it
- Delete Donation — no UI *and* no backend endpoint
- Archive Donation
- Duplicate Donation

## Evidence rule — mandatory

**Every issue must carry one of these tags. If it doesn't fit one, don't add it:**

- 📱 Observed on your real phone
- 👤 Reported by a real tester
- 📋 Required by Google Play or Apple
- 🐛 Functional bug

## Severity

🚫 **Blocker** — user cannot complete the donation flow (can't log in, can't upload, institution can't
claim, crash, data loss). **Fixed immediately, not batched.**

🔴 **High** — feature works but creates real frustration. Fix before launch.

🟡 **Medium** — improves quality, doesn't stop users. Fix if time allows.

🟢 **Low** — nice to have. Can wait until RC1.1.

## Batching + validation workflow

1. Batch of **10–15 issues** (Blockers fixed immediately, not batched).
2. Claude fixes the batch.
3. One APK build.
4. **You run the Regression Check, then test a full session** before creating the next batch — confirm
   fixes actually helped, and nothing else broke. Only then start Batch 2.

## Rule for Claude

**Do not propose improvements unless they carry one of the four evidence tags, or are necessary for store
compliance.** No opinion-based polish, no scope creep. If a fix needs touching something not on the list,
ask before expanding scope.

---

## Blockers — fixed immediately, not batched

| Date | App | Evidence | Expected | Actual | Root Cause | Fix | Status | Verified |
|---|---|---|---|---|---|---|---|---|
| 2026-08-04 | Admin | 📱 Real device + 🐛 code confirmed | A donation submitted by a donor is visible to Admin (dashboard count + Donations tab) from the moment it's submitted | `listInFlightDonationsForAdmin` (backing both `/admin/stats` and `/admin/donations`) deliberately excludes `Status: Pending` — a prior fix pass already restored this visibility for Reports only, never extended to Dashboard/Donations. Verified against live Sheets data: 4 real Pending donations (PT-000001, PT-000002, PT-000003, BR-000005) were confirmed invisible to Admin before the fix. | Shared Service (`listInFlightDonationsForAdmin` misuse) | `/admin/donations` now calls `listAllDonationsForAdmin`; added a new `pendingDonations` dashboard stat (`countPendingDonations`) alongside the existing "Doações em curso" tile, so pending and in-progress stay distinguishable rather than merged | Fixed (code) | 🟡 Fixed, waiting for Admin web verification after redeploy |

**Related, NOT a bug — investigated and ruled out:** the same report included "Institution can't see the donation either." Checked live data: the donor test accounts' `Active_Country_ID` was switched to Portugal/Brasil (via the Settings → "Simulate Country Detection" dev tool), while the institution accounts used for testing are registered in Angola. `listAvailableDonations` correctly scopes by the institution's own country — an Angola institution is *supposed* to not see a Portugal donation. A verified "Portugal Institution" account already exists and should see PT-000001/2/3. Not fixed because nothing is broken — flagging here so it isn't retested as if it were.

---

## Batch 1 — Open

**Version/Commit/Device:** which build exposed the issue — matters months later for knowing exactly what
introduced or revealed something. Most relevant for 📱 device-observed issues; mark N/A for 📋/🐛 findings
that came from code review rather than a specific build on a specific device.

**Expected / Actual:** state what a first-time user should experience, then what actually happens — this
makes the issue actionable without anyone having to rediscover the context later.

**Root Cause / Epic:** classify per Rule 0 in `RC1_EXPERT_UX_AUDIT.md` (Shared Component / Shared Service /
Shared Workflow / Single Screen), then tag which epic it belongs to (Epic 1 Shared UI, Epic 2 Shared Lists,
Epic 3 Screen-Specific). A device-testing finding that turns out to share a root cause with an existing
audit finding gets folded into that finding, not treated as a new one — this is what keeps the batches from
becoming a list of five symptoms of the same underlying problem.

| Version | Commit | Device | App | Screen | Priority | Evidence | Expected | Actual | Root Cause | Epic | Suggested Fix | Owner | Status | Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| N/A | N/A (code review) | N/A | Both | Shared `Button` component | 🔴 High | 📋 Store compliance | Screen-reader users can identify and hear every button's purpose; every tap target meets Apple's 44pt minimum | No `accessibilityRole`/`accessibilityLabel` anywhere; touch target ~43px, just under the minimum | Shared Component (`Button.tsx`) | Epic 1 | Add accessibility props at the component level; bump `minHeight` to 48 | Claude | Open | ☐ Not tested |
| Confirm | b45799b+ | Web (Admin) | Admin | Dashboard + Donations tab | 🟡 Medium | 📱 Real device | Admin can see, at a glance, how many pending donations exist per country, and can filter the Donations list to one country instead of scrolling a mixed list | "Doações pendentes" is one mixed total across all countries; Donations list has no country filter at all | Shared Workflow (same country-filter pattern needed on 2 Admin surfaces: dashboard stat breakdown + donations list filter — `listVerifiedInstitutions` already has this exact optional-`countryId` pattern to reuse) | Admin — joins the larger Admin batch below, epic TBD once that full list is classified | Break `pendingDonations` into a per-country count on the dashboard; add a country `<select>` filter to the Donations page, same pattern as the existing institution country filter | Claude | Open | ☐ Not tested |
| Confirm | Confirm | Confirm | Both | `SignInScreen` | 🔴 High | 📱 Real device + 🐛 code confirmed | On opening the sign-in screen, a user immediately knows which app they're in (Donor vs. Institution) | No logo or app-identity element on either app's sign-in screen — both are visually identical (`SignInScreen.tsx`, both apps: title text only, no `Image`/logo) | Shared Component (`SignInScreen` layout, same in both apps) | Epic 1 | Add app logo/wordmark + app name above the title on both apps' sign-in screens | Claude | Open | ☐ Not tested |
| Confirm | Confirm | Confirm | Donor | `MyDonationsScreen` ("Minhas Doações") | 🔴 High | 📱 Real device + 🐛 code confirmed | Newest donation appears at the top of the list | List is unsorted; Sheets appends new rows at the bottom, so the most recent donation lands last | Shared Service (`listDonationsByDonor` in `apps/api/src/services/donations.ts`) | Epic 2 | Add `.sort((a, b) => (b.Date_Submitted \|\| '').localeCompare(a.Date_Submitted \|\| ''))`, matching every sibling list function | Claude | Open | ☐ Not tested |

*(App/Screen/Priority/Evidence/Expected/Actual are required; Root Cause/Epic fill in during triage against
`RC1_EXPERT_UX_AUDIT.md`, the rest as you go)*

**Owner:** Claude (code fix) · You (a decision/content/account-side thing) · Both (needs your input, then
a code fix).

**Verified:** ☐ Not tested → 🟡 Fixed, waiting for device verification → ✅ Verified on real device. An
issue is only closed once it's ✅, not just because the code changed.

---

## Batch 2 — Investigated 2026-08-04, classification proposed, nothing implemented yet

Source: real-device/real-admin-usage report covering Donor, Institution, and Admin in one session.
Every item below was checked against the actual current code (not assumed from the description)
before being classified. Per Rule 0, nothing here gets implemented until you approve the grouping.

### Corrections — reported as bugs, not confirmed as bugs

These four are flagged here, not in the epics below, so they don't get "fixed" against a premise
that isn't actually true:

- **"No code generator for corporate accounts"** — it exists. `apps/admin/src/app/companies/page.tsx`
  has a "generate code" action per company (`onGenerateCode`), wired to
  `POST /admin/corporate-accounts/:id/codes` → `createInvitationCode`. The Donor-side "Código de
  convite" field in Settings redeems exactly that code. This isn't a missing feature — it's that the
  generator lives inside each company's row in the Companies tab, which is easy to miss. Worth a
  small discoverability fix (clearer label/placement), not the "review the logic, it doesn't make
  sense" framing.
- **"Resolve button stays active after a dispute is resolved"** — checked both ends: the backend
  (`resolveDispute`) already throws if a dispute's `Status !== 'Open'`, and the Admin Disputes page
  only ever loads the *pending* list (`/admin/disputes/pending`) — a resolved dispute drops off the
  list entirely, so its "Resolver" button is never shown again in the first place. Nothing to fix here.
- **"Institution can't see the donation"** — already resolved as a non-bug in the Blockers section
  above (test-account country mismatch, not a defect). Cross-referencing so it isn't logged twice.
- **Available Donations tab label** — the tab bar already just says "Disponíveis" (not "Doações
  Disponíveis"). Only the in-screen header still says the longer "Doações Disponíveis" — a much
  smaller change than "the tab" suggested. Folded into Epic 1 below at the right scope.

### Epic 1 (extends the existing one) — Shared UI Components

- **Status color coding.** `packages/shared/src/lib/status.ts`'s `DONATION_STATUS_TONE` currently
  gives `Claimed`, `Collection_Scheduled`, and `Collected` the *same* tone (`info`) — three different
  real-world stages render as the same badge color, with only `Pending` (warning) and `Delivered`
  (success) visually distinct. This is almost certainly the "no visual distinction between accepted
  and booked" complaint, and it's a one-file fix (the map, not the Badge component) reaching every
  screen that shows a status badge in both apps.
- **Available Donations header text** — "Doações Disponíveis" → shorter, to match the tab label.
- **Institution/Donor logo+name sizing** — needs your confirmation on which element you meant before
  I touch it: in the Institution app, the small 18×18px/13.5px element next to a donation is the
  **donor's** logo/name (`Donor_Display_Logo`/`Donor_Display_Name`), not an institution's — there's
  no "institution" identity shown small anywhere I can find in that app. The Donor app's own
  `InstitutionsScreen` shows an institution's logo/name at 40×40px/16px, noticeably larger. Let me
  know if you meant the donor badge inside Institution (and want it bigger), or something else.

### Epic 2 (extends the existing one) — Shared List Experience

- **Institution's "Aceites" (claimed) list is also unsorted** — same missing-sort pattern as B1, but
  a different function (`listDonationsClaimedByInstitution` vs. `listDonationsByDonor`). Should be
  fixed in the same pass as B1 rather than treated as unrelated.
- **Refetch-on-focus gap — two more confirmed instances of B2**, not new root causes: Institution's
  `DisputesListScreen` and `MySuccessStoriesScreen` both fetch once on mount only (no
  `useFocusEffect`, no pull-to-refresh) — exactly why a dispute resolution or Success Story
  approval/rejection made by Admin never appears without a full app restart. Folds into B2.
- **Active vs. Delivered visual separation.** Both Donor's My Donations and Institution's Aceites
  list currently render every status in one flat list with no divider. You raised two options —
  (a) a divider line within the existing list (small, same-screen change) vs. (b) a genuinely
  separate tab for active vs. delivered (bigger — a navigation/tab-structure change). I'd recommend
  starting with (a); I can scope (b) separately if (a) doesn't feel like enough once you've tried it.
- **Date-format inconsistency.** A shared formatter already exists
  (`packages/shared/src/lib/relative-date.ts`, `formatDateLabel` → `dd/mm/yyyy` via `pt-PT` locale)
  and most screens use it, but `NotificationsScreen` (both apps) and Institution's
  `DisputesListScreen` bypass it with raw `toLocaleString()` (device-default format). One clarifying
  question for you: is `dd/mm/yyyy` (what the shared formatter already produces) what you meant by
  "date month year," or did you want it spelled out (e.g. "4 de agosto de 2026")? That changes the fix.

### New Epic — Donor/Institution Screen-Specific (no shared root cause)

- **Donor: no navigation after submitting a donation.** `DonateScreen` shows a success toast/banner
  and clears the form, but never calls `navigation.navigate(...)` — confirmed zero navigation calls
  in the file. Matches your exact complaint.
- **Donor: My Donations card never shows the item's own photo.** Confirmed `Donation.Photo` is never
  referenced in `MyDonationsScreen.tsx` — the only image shown is a linked Success Story's photo,
  conditionally, at the bottom (which is already correct and matches "as it is now"). Adding the
  item photo at the top of the card is a clean, scoped fix.
- **Institution: Success Story photo — gallery only, no camera.** Confirmed: only
  `launchImageLibraryAsync` is called, `launchCameraAsync` never appears in the file. This is the
  same camera capability already tracked in `VERSION_2_ROADMAP.md` (why `CAMERA`/`RECORD_AUDIO`
  permissions were kept, not removed) — this makes it concretely actionable now rather than backlog.
- **HomeScreen doesn't show the person's name (Donor and Institution).** This one isn't purely a
  screen fix — the session payload itself (`AuthenticatedUser` in `packages/shared/src/types/session.ts`)
  has no `name` field at all, even though `User.Name` exists server-side. Adding it means touching the
  shared session type and whatever builds it, then both HomeScreens. Classifying as Shared Service +
  Shared Workflow, not Single Screen, because of that.

### New Epic — Admin Web (not covered by the original mobile-only UX audit)

- **Change Request approval always shows a plain text field**, even though the system already knows
  which field is being changed (`Field_Requested`/`Field_Label`). Only `Location` gets a hint (still
  just free text, not real validation). Fix: render an input appropriate to the field — Name/Type/
  Needs_List stay text (they genuinely are text), Location gets real paired lat/lng inputs instead of
  a hint on a text field.
- **Admin Users list is sorted newest-joined-first, not alphabetically**, and blank-name users
  (exist between account creation and profile completion) have no special placement — confirmed both
  facts directly. Fix: sort by Name, decide blank-name placement (you suggested bottom).
- **Corporate Account "country" is free text**, not a dropdown tied to the same Geo_Regions system
  used everywhere else in the app (donor country, institution country, donation country). Found this
  while investigating your "why does this feature exist" question — it's a real inconsistency worth
  fixing alongside explaining the feature's actual purpose (a Corporate Account is a reporting/
  attribution grouping tied to donors via invite code — nobody logs in "as" the company, so no email
  field is actually needed there, that part isn't a gap).
- **Admin Donations: date fields stay editable after Delivered.** Confirmed no `disabled` logic tied
  to `Status` anywhere on that page. Also confirmed, directly contradicting the "eight days" auto-
  offset — **there is no automatic date math anywhere in the code.** Grepped the whole repo for any
  hardcoded day-offset; found none. Each field only changes when you explicitly edit and save it, and
  the two fields never affect each other. If you saw them looking related, it was two manual edits,
  not automation — worth mentioning so you're not looking for a bug that isn't there.
- **Admin Donations: institution name is visually subordinate to the item type** — confirmed
  (13.5px muted vs. 16px bold). Simple style fix.
- **Admin dashboard stat cards aren't clickable at all** — confirmed, all seven are plain `<Card>`
  with no link/onClick. Fix: wire each to its corresponding list page.
- **Admin Reports CSV is a raw dump of internal fields**, not curated — confirmed the export just
  does `Object.keys(rows[0])` on whatever the API returns (the full internal `AdminDonationView`
  shape), so yes, `Donation_ID`/`Public_Donation_Code` *are* technically in there, just buried among
  every other internal field with no human labels or chosen order. Needs a real curated column list
  — separate from PDF/charts, see below.

### Needs your decision before I scope it further — bigger than a normal batch item

- **Push notifications.** Confirmed: zero push infrastructure exists anywhere in the codebase (no
  Expo push tokens, no FCM, no `firebase-admin/messaging`) — every notification today is in-app only.
  Building real push delivery is new infrastructure (SDK integration, token registration/storage,
  a sending service), not a UI tweak, and arguably brushes up against Version 1 Feature Freeze. Worth
  a deliberate go/no-go from you rather than folding into a batch. Separately, smaller and safe to
  include in the Admin epic above: the broadcast UI already supports role/country filters but the
  backend explicitly rejects a fully-unfiltered "everyone" broadcast — that part's a small, contained fix.
- **PDF export + charts for Reports.** Real, substantial new work (a new export format plus chart
  rendering), not a small fix. Once the CSV column-curation fix above ships, I'd suggest deciding
  separately whether PDF/charts are worth the effort before RC1 or belong in `VERSION_2_ROADMAP.md`.

### Not enough evidence yet

- **"All apps responding too slowly."** No specific screen, action, or timing given, so there's
  nothing concrete to investigate yet — this doesn't meet the evidence bar the rest of this log holds
  to. Next time it happens, note which screen/action and roughly how slow (e.g. "Donations tab takes
  ~5s to load on Institution"), and I'll profile that specifically.

---

## Batch 3 — Investigated 2026-08-04, classification proposed, nothing implemented yet

### Confirmed, ready to scope

- **No logout confirmation anywhere.** Checked every "Sair"/"Terminar sessão" button — Donor
  (`SettingsScreen.tsx`, `HomeScreen.tsx`), Institution (`SettingsScreen.tsx`,
  `VerificationStatusScreen.tsx`), and Admin (`AppShell.tsx`) — all five call `signOutUser()`
  directly with zero confirmation step. Shared Workflow, same missing pattern in 5 places (a native
  `Alert.alert` confirm on mobile, a confirm dialog on Admin web).
- **Admin has no "all institutions" list — only a pending-review queue.** Confirmed:
  `apps/admin/src/app/institutions/page.tsx` calls only `/admin/institutions/pending` and is titled
  "Instituições Pendentes." `listAllInstitutions` already exists as a service function but is
  currently wired to nothing except the Reports CSV export — there's no page a human can browse to
  see every institution (verified + rejected included) the way the Users page lets you see every
  user. Real, confirmed gap, matches your comparison to Users exactly.
- **Admin Users list shows no country at all.** Confirmed — `apps/admin/src/app/users/page.tsx`
  renders Name/Email/Role only. One clarifying question: "origin" could mean `Home_Country_ID` (where
  they registered from, fixed) or `Active_Country_ID` (can change, e.g. via the Settings country-
  simulation tool) — I'd default to showing `Home_Country_ID` as "origin" unless you mean something else.
- **No self-service password change/reset in Donor or Institution.** Confirmed asymmetry: Admin
  already has a working "Redefinir password" button per user (`sendPasswordResetEmail` — sends
  Firebase's standard reset-link email), but neither mobile app has a "Forgot password?" link on
  Sign In or a "Change password" option in Settings — a user can only get a password reset if an
  Admin does it for them. Same underlying Firebase call already proven in Admin, just missing on the
  user-facing side. Shared Workflow (SignInScreen, both apps).
- **Address/personal info not shown to the user anywhere.** Confirmed no address is displayed in
  either app's Home or Settings. Deeper finding: **there's no stored "address" text field in the data
  model at all** for either Donor or Institution — only geographic coordinates (`Location: {lat,lng}`).
  Showing an address would mean either reverse-geocoding the stored coordinates into readable text for
  display (no schema change) or adding a real stored address field (bigger change). Needs your input
  on which — see open questions below.

### Couldn't reproduce as described — need one more detail from you

- **"Coordinates says optional but is required" (Institution registration).** Read
  `apps/mobile-institution/src/screens/RegisterScreen.tsx` closely: the three fields actually labeled
  "(opcional)" — Needs List, Service Radius, Coverage Area — are genuinely optional in both the UI and
  the backend validation, no mismatch there. The Location/GPS section itself is not labeled optional
  anywhere in the current code — it's presented as automatic (captured via GPS, with a manual-address
  fallback if GPS fails) and is required to submit. I can't find the specific "says optional, acts
  required" contradiction you saw. Could you confirm the exact field label next time you hit it, or a
  screenshot? I'd rather not guess and fix the wrong thing.
- **"Why does it ask to confirm the address" during registration.** Genuinely unclear what this
  refers to — which field, which screen exactly (Donor or Institution registration)? Happy to
  investigate once I know what "confirm" refers to.

### Open questions before I finalize scope

1. For the Users country column — `Home_Country_ID` (origin) or `Active_Country_ID` (current), or both?
2. For address visibility — reverse-geocode existing coordinates into a readable address (no schema
   change), or do you want a real stored address field added to registration? These are different
   sizes of work.

---

## Resolved

*(moved here once ✅ Verified on real device, with the commit hash)*
