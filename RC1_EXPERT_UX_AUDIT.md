# RC1 Expert UX Audit (Feature Freeze)

**Scope:** all 23 screens across Donor and Institution mobile apps, reviewed against usability, navigation,
discoverability, efficiency, accessibility, consistency, and readability only — no redesign, no new
features, no subjective preferences. Every finding below is grounded in the actual source code (file/line
level), not a guess. Screens with no objective finding are listed as reviewed, not skipped.

**Severity uses the same scale as `PILOT_FEEDBACK_LOG.md`:** Blocker / High / Medium / Low. Nothing found
here blocks completing the donation flow, so there are no Blockers.

**Methodology rule for this and future audits:** before reporting a finding, determine whether it
originates from a shared component, shared list-screen pattern, shared backend service, or a single screen.
Group and report by root cause, not by screen — a single fix to a shared component or service resolves
every instance at once, so that's the unit of work that matters, not how many screens happen to display the
symptom.

## Rule 0 — Never implement one issue alone

Every issue is classified as exactly one of:
- **Shared Component** — one reusable UI piece, fixed once.
- **Shared Service** — one backend function, fixed once.
- **Shared Workflow** — one pattern applied consistently across screens (not one shared file, but one
  repeated fix).
- **Single Screen** — no shared dependency; isolated.

**No fix starts until this classification is done.** This is what the Epic 1/2/3 split below already is —
applied, not just stated:

| Finding | Classification |
|---|---|
| A1 (Button) | Shared Component |
| A2 (11 custom Pressables) | Shared Workflow (same pattern, 11 separate files — not one file fixes all) |
| A3 (filter chips) | Shared Component (same file/pattern as A1/A2, single screen instance) |
| B1 (donation sort) | Shared Service (`listDonationsByDonor`) |
| B2 (pull-to-refresh) | Shared Workflow (one pattern, applied per-screen) |
| C1, C2 | Single Screen |

---

## Epic 1 — Shared UI Components (accessibility + touch targets)

**Owner:** Claude (single implementer on this project — no separate UI/Mobile/Feature engineers exist here,
so this is about keeping the *work* scoped to one coherent pass, not staffing).
**Impact:** fixes multiple screens simultaneously — `Button.tsx` is a true single-fix-many-places change;
the 11 custom instances are the same pattern repeated, each needing its own line, done in the same pass.

### A1. Shared `Button` component has no accessibility support and a borderline touch target
**Reach:** every screen in both apps (it's the primary control everywhere).
**Severity:** High
**Evidence:** `apps/{mobile-donor,mobile-institution}/src/components/Button.tsx` — no `accessibilityRole`
or `accessibilityLabel` anywhere; `paddingVertical: spacing[3]` (12px) + text ≈ 43px total height, under
Apple's 44pt minimum.
**Explanation:** screen-reader users can't identify these as buttons or hear their purpose announced.
Marginally undersized targets increase mis-taps for anyone with reduced dexterity or larger fingers — this
is the single highest-leverage fix on this list since one component change reaches nearly every screen.
**Smallest fix:** add `accessibilityRole="button"` and an `accessibilityLabel` derived from `children` when
it's a string; add `minHeight: 48` to the base style.

### A2. Custom `Pressable`/`TouchableOpacity` elements (outside the shared Button) also lack accessibility props
**Reach:** `DonateScreen`, `NotificationsScreen` (both apps), `MyDonationsScreen`,
`AvailableDonationsScreen`, `ClaimedByMeScreen`, `MySuccessStoriesScreen`, `NewSuccessStoryScreen` — 11
instances total.
**Severity:** High
**Evidence:** none of these 11 usages set `accessibilityRole`/`accessibilityLabel`/`accessibilityState`.
**Explanation:** same class of problem as A1, in hand-rolled interactive elements — notification list items,
the photo-upload well, "Ver no mapa" links, and (see A3) filter chips all read as plain, non-interactive
text to a screen reader.
**Smallest fix:** add `accessibilityRole="button"` (or `"link"` for the map links) and a short
`accessibilityLabel` to each of the 11 usages.

### A3. `MySuccessStoriesScreen` filter chips are well under the touch-target minimum
**Reach:** `apps/mobile-institution/src/screens/MySuccessStoriesScreen.tsx` (single screen, grouped here
because it's the same touch-target/accessibility root cause as A1/A2, fixable in the same engineering pass).
**Severity:** High
**Evidence:** `filterChip: { paddingVertical: 6, paddingHorizontal: 12 }` with 12px text — total height
≈28px, well under the 44pt/48dp platform minimums (compare to Button's already-borderline ~43px).
**Explanation:** these are the only way to filter Approved/Pending/Rejected stories; a target this small is
genuinely hard to hit reliably, more so than the Button issue above.
**Smallest fix:** increase `paddingVertical` to at least 10–12 (≈44px total), and add
`accessibilityRole="button"` + `accessibilityState={{ selected: filter === f }}`.

---

## Epic 2 — Shared List Experience (backend service + shared list-screen pattern)

**Owner:** Claude.
**Impact:** improves every list in both apps — a one-line sort fix in the backend, plus one reusable
`RefreshControl` pattern applied to every list screen's existing fetch function. No new data-fetching logic
needed for either.

### B1. Donor's "Minhas Doações" is not sorted — donations appear oldest-first
**Reach:** `apps/mobile-donor/src/screens/MyDonationsScreen.tsx`, backed by
`apps/api/src/services/donations.ts` `listDonationsByDonor()` — a backend service, so the root cause is
one function, not the screen.
**Severity:** High
**Evidence:** `listDonationsByDonor` filters and maps rows with no `.sort()` at all — confirmed by reading
the function directly. Every *other* list function in the same file explicitly sorts newest-first:
`listDonationsClaimedByInstitution` sorts by `Date_Claimed` descending, the available-donations list sorts
by `Date_Submitted` descending, and both notification list functions sort by `Created_At` descending. This
one function is the sole exception — an inconsistency, not a deliberate design choice.
**Explanation:** Google Sheets appends new rows at the bottom; with no sort applied, a donor's newest
donation — the one they most likely just submitted and want to check on — lands at the very bottom of the
list, past everything else.
**Smallest fix:** add the same one-line sort already used elsewhere:
`.sort((a, b) => (b.Date_Submitted || '').localeCompare(a.Date_Submitted || ''))`.

### B2. No pull-to-refresh or refetch-on-focus anywhere in either app
**Reach:** every list screen, both apps — a shared pattern gap, not a per-screen one.
**Severity:** High
**Evidence:** zero matches for `RefreshControl` or `useFocusEffect` anywhere in either app's source. Every
list only fetches once, in a `useEffect` keyed on mount/`firebaseUser` — never on tab refocus.
**Explanation:** most concretely affects Institution's "Doações Disponíveis" — a genuinely time-sensitive
screen (new donations should be claimable promptly), plus Notifications and Claimed Donations. If new data
appears while a screen is open, there's no discoverable way to see it short of force-closing and reopening
the app. React Navigation's bottom tabs keep screens mounted by default, so even switching tabs and back
isn't guaranteed to refetch.
**Smallest fix:** add a `RefreshControl` (standard pull-to-refresh) to each `FlatList`, wired to the
existing `load()`/fetch function already present on every one of these screens.

---

## Epic 3 — Screen-Specific Improvements (no shared root cause — each is its own fix)

**Owner:** Claude.
**Impact:** localized fixes, no shared dependency between them or with Epics 1/2 — kept as their own group
specifically *because* forcing them into a shared category would be organizational theater, not a real
efficiency gain (see note below).

These two don't share a root cause with each other or with A/B — grouping them together would be
cosmetic organization, not a real shared fix, so they're kept separate rather than forced into a category.

### C1. `MySuccessStoriesScreen`'s filtered-empty state doesn't distinguish "no stories at all" from "no stories matching this filter"
**Screen:** `apps/mobile-institution/src/screens/MySuccessStoriesScreen.tsx`
**Severity:** Medium
**Evidence:** the `EmptyState` shown when `filtered?.length === 0` always reads "Sem histórias / Publique
uma história de impacto a partir de uma doação entregue," regardless of whether `filter` is `'all'` or one
of the specific statuses.
**Explanation:** an institution with several Approved stories but zero Rejected ones, tapping the
"Rejeitadas" filter, sees a message implying they've never published anything — misleading, since they
have, just not in that filter.
**Smallest fix:** branch the `EmptyState` copy on whether `filter === 'all'` vs. a specific status.

### C2. `NewSuccessStoryScreen`'s Description field reuses the single-line `Input` component instead of the app's own textarea pattern
**Screen:** `apps/mobile-institution/src/screens/NewSuccessStoryScreen.tsx`
**Severity:** Medium
**Evidence:** `Input` (shared component) has no `minHeight`/`textAlignVertical` in its styles — fine for
single-line fields, but `NewSuccessStoryScreen` passes `multiline` into it for a description field allowing
up to 600 characters. Compare to `NewDisputeScreen` and `DonateScreen`'s notes-style fields, which both use
a dedicated `textarea` style with `minHeight: 120` and `textAlignVertical: 'top'` — the correct pattern
already exists elsewhere, just not used here.
**Explanation:** without explicit multiline sizing, Android in particular tends to vertically center text in
a growing field rather than anchor it to the top, which reads as cramped/awkward for a paragraph-length
field.
**Smallest fix:** apply the same `textarea`-style sizing already used in `NewDisputeScreen`/`DonateScreen`.

---

## Screens reviewed with no objective finding

`HomeScreen` (both apps), `SettingsScreen` (both apps), `NotificationsScreen` (both apps, beyond A2),
`SignInScreen`/`SignUpScreen` (both apps), `OnboardingProfileScreen`, `ImpactScreen`, `InstitutionsScreen`,
`RegisterScreen`, `VerificationStatusScreen`, `DisputesListScreen`, `NewDisputeScreen`,
`AvailableDonationsScreen`/`ClaimedByMeScreen` (beyond A2/B1/B2). Loading and empty states are otherwise
consistent across every list screen (same `EmptyState` component, same "A carregar…" pattern); error
handling is consistent (`ApiError` + inline banners everywhere); status labels are human-readable
Portuguese, not raw field names, throughout. No branding inconsistencies found in this pass.

---

## Summary

| Epic | Findings | Severity | Status |
|---|---|---|---|
| Epic 1 — Shared UI Components | A1, A2, A3 | High × 3 | Not started |
| Epic 2 — Shared List Experience | B1, B2 | High × 2 | Not started |
| Epic 3 — Screen-Specific Improvements | C1, C2 | Medium × 2 | Not started |

**Each epic closes only after:** implementation → regression check (`PILOT_FEEDBACK_LOG.md`'s Regression
Check list) → one APK build → verification on your phone → then, and only then, the next epic starts.

No architectural or feature-level issues found — everything above is a targeted, small fix (a style
property, a sort call, a set of accessibility props) that doesn't touch business logic or navigation
structure. Per the instructions this audit was run under: nothing here was implemented, this is findings
only.

---

## How this maps to the broader 5-epic release structure

The recommended release-level framing was: Epic 1 Shared UI & Accessibility, Epic 2 Lists & Refresh,
Epic 3 Authentication & Branding, Epic 4 Final Store Compliance, Epic 5 Real-Device Polish. Mapped against
what actually exists in this repo today, rather than creating a parallel structure:

- **Epic 1 & 2** = the two epics above, in this document.
- **Epic 3 (Auth & Branding)** — this audit found **zero** findings here (auth screens were reviewed;
  branding was already frozen and separately verified in `WAFINA_BRAND_GUIDE.md` /
  `BRANDING_FREEZE_CHECKLIST.md`). Nothing to open until real-device testing or a tester surfaces something
  evidence-backed.
- **Epic 4 (Store Compliance)** — already has its own dedicated, more thorough tracking than a UX audit
  would produce: `COMPLIANCE_INFORMATION.md` and the RC1 Launch Readiness Audit done earlier this session.
  Not duplicated here.
- **Epic 5 (Real-Device Polish)** — this *is* `PILOT_FEEDBACK_LOG.md`, already the exact mechanism for
  evidence-tagged, batched, device-verified fixes.

Kept them separate rather than merging everything into one new "5 epics" document, since each already has
the right home and merging would create two sources of truth for the same information.
