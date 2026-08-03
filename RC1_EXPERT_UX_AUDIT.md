# RC1 Expert UX Audit (Feature Freeze)

**Scope:** all 23 screens across Donor and Institution mobile apps, reviewed against usability, navigation,
discoverability, efficiency, accessibility, consistency, and readability only — no redesign, no new
features, no subjective preferences. Every finding below is grounded in the actual source code (file/line
level), not a guess. Screens with no objective finding are listed as reviewed, not skipped.

**Severity uses the same scale as `PILOT_FEEDBACK_LOG.md`:** Blocker / High / Medium / Low. Nothing found
here blocks completing the donation flow, so there are no Blockers.

---

## Findings

### 1. Shared `Button` component has no accessibility support and a borderline touch target
**Screens affected:** every screen in both apps (it's the primary control everywhere).
**Severity:** High
**Evidence:** `apps/{mobile-donor,mobile-institution}/src/components/Button.tsx` — no `accessibilityRole`
or `accessibilityLabel` anywhere; `paddingVertical: spacing[3]` (12px) + text ≈ 43px total height, under
Apple's 44pt minimum.
**Explanation:** Screen-reader users can't identify these as buttons or hear their purpose announced.
Marginally undersized targets increase mis-taps for anyone with reduced dexterity or larger fingers — this
is the single highest-leverage fix on this list since one component change reaches nearly every screen.
**Smallest fix:** add `accessibilityRole="button"` and an `accessibilityLabel` derived from `children` when
it's a string; add `minHeight: 48` to the base style.

### 2. Custom `Pressable`/`TouchableOpacity` elements (outside the shared Button) also lack accessibility props
**Screens affected:** `DonateScreen`, `NotificationsScreen` (both apps), `MyDonationsScreen`,
`AvailableDonationsScreen`, `ClaimedByMeScreen`, `MySuccessStoriesScreen`, `NewSuccessStoryScreen` — 11
instances total.
**Severity:** High
**Evidence:** none of these 11 usages set `accessibilityRole`/`accessibilityLabel`/`accessibilityState`.
**Explanation:** same class of problem as #1, in hand-rolled interactive elements — notification list items,
the photo-upload well, "Ver no mapa" links, and (see #3) filter chips all read as plain, non-interactive
text to a screen reader.
**Smallest fix:** add `accessibilityRole="button"` (or `"link"` for the map links) and a short
`accessibilityLabel` to each of the 11 usages.

### 3. `MySuccessStoriesScreen` filter chips are well under the touch-target minimum
**Screen:** `apps/mobile-institution/src/screens/MySuccessStoriesScreen.tsx`
**Severity:** High
**Evidence:** `filterChip: { paddingVertical: 6, paddingHorizontal: 12 }` with 12px text — total height
≈28px, well under the 44pt/48dp platform minimums (compare to Button's already-borderline ~43px).
**Explanation:** These are the only way to filter Approved/Pending/Rejected stories; a target this small is
genuinely hard to hit reliably, more so than the Button issue above.
**Smallest fix:** increase `paddingVertical` to at least 10–12 (≈44px total), and add
`accessibilityRole="button"` + `accessibilityState={{ selected: filter === f }}` (folds in #2 for this
specific case, since it's the same file).

### 4. Donor's "Minhas Doações" is not sorted — donations appear oldest-first
**Screen:** `apps/mobile-donor/src/screens/MyDonationsScreen.tsx`, backed by
`apps/api/src/services/donations.ts` `listDonationsByDonor()`
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

### 5. No pull-to-refresh or refetch-on-focus anywhere in either app
**Screens affected:** every list screen, both apps.
**Severity:** High
**Evidence:** zero matches for `RefreshControl` or `useFocusEffect` anywhere in either app's source. Every
list only fetches once, in a `useEffect` keyed on mount/`firebaseUser` — never on tab refocus.
**Explanation:** most concretely affects Institution's "Doações Disponíveis" — a genuinely time-sensitive
screen (new donations should be claimable promptly). If a new donation appears while an institution has the
tab open, there's no discoverable way to see it short of force-closing and reopening the app. React
Navigation's bottom tabs keep screens mounted by default, so even switching tabs and back isn't guaranteed
to refetch.
**Smallest fix:** add a `RefreshControl` (standard pull-to-refresh) to each `FlatList`, wired to the
existing `load()`/fetch function already present on every one of these screens — no new data-fetching logic
needed, just exposing the refetch that already exists on mount.

### 6. `MySuccessStoriesScreen`'s filtered-empty state doesn't distinguish "no stories at all" from "no stories matching this filter"
**Screen:** `apps/mobile-institution/src/screens/MySuccessStoriesScreen.tsx`
**Severity:** Medium
**Evidence:** the `EmptyState` shown when `filtered?.length === 0` always reads "Sem histórias / Publique
uma história de impacto a partir de uma doação entregue," regardless of whether `filter` is `'all'` or one
of the specific statuses.
**Explanation:** an institution with several Approved stories but zero Rejected ones, tapping the
"Rejeitadas" filter, sees a message implying they've never published anything — misleading, since they
have, just not in that filter.
**Smallest fix:** branch the `EmptyState` copy on whether `filter === 'all'` vs. a specific status (e.g.
"Sem histórias rejeitadas" when a specific filter yields zero results).

### 7. `NewSuccessStoryScreen`'s Description field reuses the single-line `Input` component instead of the app's own textarea pattern
**Screen:** `apps/mobile-institution/src/screens/NewSuccessStoryScreen.tsx`
**Severity:** Medium
**Evidence:** `Input` (shared component) has no `minHeight`/`textAlignVertical` in its styles — fine for
single-line fields, but `NewSuccessStoryScreen` passes `multiline` into it for a description field allowing
up to 600 characters. Compare to `NewDisputeScreen` and `DonateScreen`'s notes-style fields, which both use
a dedicated `textarea` style with `minHeight: 120` and `textAlignVertical: 'top'` — the correct pattern
already exists elsewhere in the codebase, just not used here.
**Explanation:** without explicit multiline sizing, Android in particular tends to vertically center text in
a growing field rather than anchor it to the top, which reads as cramped/awkward for a field meant to hold a
paragraph.
**Smallest fix:** apply the same `textarea`-style sizing (`minHeight`, `textAlignVertical: 'top'`) already
used in `NewDisputeScreen`/`DonateScreen`, for consistency and readability.

---

## Screens reviewed with no objective finding

`HomeScreen` (both apps), `SettingsScreen` (both apps), `NotificationsScreen` (both apps, beyond finding
#2), `SignInScreen`/`SignUpScreen` (both apps), `OnboardingProfileScreen`, `ImpactScreen`,
`InstitutionsScreen`, `RegisterScreen`, `VerificationStatusScreen`, `DisputesListScreen`, `NewDisputeScreen`,
`AvailableDonationsScreen`/`ClaimedByMeScreen` (beyond findings #2/#4/#5). Loading and empty states are
otherwise consistent across every list screen (same `EmptyState` component, same "A carregar…" pattern);
error handling is consistent (`ApiError` + inline banners everywhere); status labels are human-readable
Portuguese, not raw field names, throughout.

---

## Summary

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 5 |
| Medium | 2 |
| Low | 0 |

No architectural or feature-level issues found — everything above is a targeted, small fix (a style
property, a sort call, a set of accessibility props) that doesn't touch business logic or navigation
structure. Per the instructions this audit was run under: nothing here was implemented, this is findings
only.
