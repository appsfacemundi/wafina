# Mobile App Localization Audit — Wafina Doador & Instituição

**Date:** 2026-08-12. Source-code-level audit, not a live PT/EN device test (per the instruction to test
"at the source-code level"). Every count below is a direct `grep` against the real files, re-verified twice
after an initial loose pattern gave misleading (inflated) numbers — the figures here are the corrected,
double-checked ones.

**Headline finding: the i18n infrastructure exists (6 languages configured: pt/en/es/fr/zh/ar) but is
wired into only 7 files total across both mobile apps.** Every other screen is 100% hardcoded Portuguese
with no translation path at all — switching the app to English changes the sign-in screen and the tab bar,
and nothing else.

---

## Where `useTranslation` is actually used

| App | File | Status |
|---|---|---|
| Donor | `screens/SignInScreen.tsx` | Translated |
| Donor | `screens/HomeScreen.tsx` | Translated |
| Donor | `components/LanguageSwitcher.tsx` | Translated (the switcher itself) |
| Donor | `navigation/RootNavigator.tsx` | Translated (tab bar labels only) |
| Institution | `screens/SignInScreen.tsx` | Translated |
| Institution | `components/LanguageSwitcher.tsx` | Translated (the switcher itself) |
| Institution | `navigation/RootNavigator.tsx` | Translated (tab bar labels only) |

That's it. Confirmed via `grep -rl "useTranslation"` across both apps' `src/` — no other match.

## Everything else — per-screen coverage

**Wafina Doador** (11 of 12 screens, 0 of 20 shared components):

| Screen | Lines | i18n calls |
|---|---|---|
| DonateScreen.tsx | 875 | 0 |
| ReceberScreen.tsx | 1,462 | 0 |
| MyDonationsScreen.tsx | 451 | 0 |
| SettingsScreen.tsx | 492 | 0 |
| ImpactScreen.tsx | 201 | 0 |
| InstitutionsScreen.tsx | 188 | 0 |
| NotificationsScreen.tsx | 164 | 0 |
| OnboardingProfileScreen.tsx | 116 | 0 |
| SignUpScreen.tsx | 99 | 0 |
| All 20 shared components (`Button`, `Card`, `Badge`, `ThankYouNoteModal`, `SwitchCountryPrompt`, etc.) | — | 0 |

**Wafina Instituição** (12 of 13 screens, 0 of 13 shared components):

| Screen | Lines | i18n calls |
|---|---|---|
| ClaimedByMeScreen.tsx | 614 | 0 |
| RegisterScreen.tsx | 342 | 0 |
| SettingsScreen.tsx | 383 | 0 |
| AvailableDonationsScreen.tsx | 317 | 0 |
| NewSuccessStoryScreen.tsx | 221 | 0 |
| HomeScreen.tsx | 217 | 0 |
| MySuccessStoriesScreen.tsx | 199 | 0 |
| NotificationsScreen.tsx | 175 | 0 |
| DisputesListScreen.tsx | 143 | 0 |
| SignUpScreen.tsx | 143 | 0 |
| NewDisputeScreen.tsx | 105 | 0 |
| VerificationStatusScreen.tsx | 78 | 0 |
| All 12 shared components | — | 0 |

**ReceberScreen alone is 1,462 lines with zero i18n integration** — this is the app's flagship RECEBER
feature (the whole reservation/PIN/collection-point flow), entirely hardcoded PT.

## Two structural root causes, not just "screens forgot to translate"

1. **`packages/shared/src/lib/status.ts`** — `DONATION_STATUS_LABEL` and its sibling maps
   (`DELIVERY_METHOD_LABEL`, `RECIPIENT_CATEGORY_LABEL`) are hardcoded Portuguese string constants, shared
   and reused identically by both mobile apps *and* all three web apps. Even a screen that correctly called
   `t()` for its own static labels would still show a Portuguese status badge, because the badge text comes
   from this one shared, non-localized source. Fixing this one file would fix donation-status display
   everywhere at once — the highest-leverage single fix if this work is ever prioritized.
2. **Backend email templates** (`apps/api/src/services/donations.ts`) — subject lines and bodies (e.g.
   `"Wafina — A sua doação foi doada a alguém que precisa"`, `"Wafina — Obrigado! A sua doação foi
   recebida"`) are hardcoded Portuguese with **no locale/language parameter used anywhere in the sending
   function** — confirmed via direct read of the function signature. Every user gets a Portuguese email
   regardless of their app language setting, because the app doesn't even have an app language setting
   that reaches the backend for this purpose (no `Preferred_Language` field consulted here).

## Classification (as requested)

**A) UI strings that MUST use i18n if full localization is pursued** — the overwhelming majority of what's
hardcoded above: screen titles, button labels, form field labels, empty-state copy, error/validation
messages, static instructional text ("Reserva válida por," "Mais informações," "Como chegar," etc.),
navigation/tab labels not yet covered.

**B) User-generated content that should stay in its original language** — donation descriptions,
institution names/descriptions/logos, Success Story text, dispute descriptions. **None of this should be
auto-translated** — confirmed no existing feature or product requirement calls for translating user
content, and doing so silently would be a real product-behavior change, not a bug fix. Not touched, not
recommended.

**C) System-generated dynamic content that SHOULD be localized if this work proceeds** — the two structural
items above (status/delivery/category labels, email subject/body), plus formatted dates/times and any
server-generated notification text surfaced in-app.

**D) Content requiring a translation strategy/API rather than plain i18n** — **none identified.** Nothing
in the current product needs runtime machine translation of arbitrary text; everything above is either
static UI copy (plain i18n keys) or user content that shouldn't be translated at all (category B). I'm not
recommending a translation-API integration because nothing found here actually needs one.

## Not fixed — by design, per this phase's rules

This is an audit, not a fix. Nothing above was changed. Given the real scope — roughly 4,000+ combined
lines across 24 screens/components in two apps, plus two shared root-cause files — this is comparable in
size to a major feature, not a quick pass, and shouldn't be started without an explicit decision.

**The actual product question worth deciding, not just the technical one:** Wafina's primary and current
launch market is Portuguese-speaking (Angola is the only currently-active country per
`PRODUCTION_READINESS_REPORT.md`). If RC1 genuinely only needs to work in Portuguese, the real bug isn't
"screens aren't translated" — it's that **the `LanguageSwitcher` is exposed and offers 6 languages that
mostly don't work**, which sets an expectation the app doesn't meet. Two honest paths, not a recommendation
either way:
1. Do the full localization pass before claiming multi-language support (large scope, described above).
2. For RC1 specifically, restrict the switcher to the languages that actually work today (Portuguese, and
   arguably English only for the ~4 screens that are covered) and treat full coverage as V2 scope — smaller,
   more honest with users in the meantime.

Not deciding this for you — flagging it because it's a real product call, not something to silently pick.
