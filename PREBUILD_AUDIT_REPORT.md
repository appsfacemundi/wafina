# WAFINA PRE-BUILD AUDIT

**Date:** 2026-08-12. Audit only — nothing built, no EAS run, no `expo run:ios`/`expo run:android`, no
Xcode/Android SDK installed, no dependency upgrades, no broad changes. A small number of unambiguous,
zero-risk items are noted as such below, but were **not** applied — this whole pass is read-only.

---

## ⚠️ Correction to the request's premise

**`apps/mobile-admin` does not exist.** Checked directly: `apps/` contains `admin`, `api`, `institution`,
`mobile-donor`, `mobile-institution`, `web` — no `mobile-admin` directory, no third mobile app anywhere in
the repo. `apps/admin` is a **Next.js web app** (`"dev": "next dev -p 3002"`), not an Expo/React Native app.
This has been true for the entire project — `branding/BRANDING_FREEZE_CHECKLIST.md` already documents
"Mobile icons — Admin: ➖ Not applicable — No mobile app exists for Admin (web-only)."

Everything below covers the two mobile apps that actually exist — **Wafina Doador**
(`apps/mobile-donor`) and **Wafina Instituição** (`apps/mobile-institution`) — in full. Admin is called
out explicitly wherever the requested format expects a third mobile entry, rather than silently omitted.

---

## Overall Status

- **Donor: 🟢**
- **Institution: 🟢**
- **Admin: 🔵 N/A** — not a mobile app; none of this audit's 15 categories apply to it as written. A
  Next.js production-readiness audit (build/env/deploy) would be a different, separate task.

---

## 🔴 Critical Issues

**None found.** Nothing discovered in this pass would block a native build for either app.

## 🟡 Warnings

1. **Dependency patch-version drift** — `expo-image-picker`/`expo-location` are `~57.0.7` in Donor but
   `~57.0.6` in Institution. Both ranges are compatible with Expo SDK 57; not a build risk today, just an
   avoidable inconsistency.
2. **`react-native-web` present only in Donor** — Institution has no web dev-testing target configured.
   Irrelevant to native iOS/Android builds; only matters if browser-based dev testing of Institution is
   ever wanted.
3. **`version: "0.0.1"` on both apps** — technically valid, but stores conventionally expect something
   like `1.0.0` for a first release. Not a build blocker; a pre-submission decision, not a pre-build one.
4. **No automated test suite anywhere in the monorepo** — pre-existing, already documented in
   `PRODUCTION_READINESS_REPORT.md`, restated here because the audit explicitly asked to check for it.
5. **No `scheme` or `runtimeVersion`/`updates` configured** in either app — no deep links, no EAS Update/OTA
   channel exists yet. Not required for a first native build.

## 🟢 Confirmed Good

Bundle/package IDs (unique, correctly formatted) · app names (clear, distinct) · icons (correct dimensions,
correct alpha channel per platform, verified safe-zone, verified composite-vs-flat pixel match) · splash
(files exist, correct role-color backgrounds, SDK-compatible plugin version) · all referenced assets exist
with correct paths/casing · production API URL (HTTPS, no localhost dependency) · Firebase config
(identical project both apps) · permissions (all purpose-specific, none excessive) · `tsc --noEmit` clean
both apps · `eslint` clean both apps, zero warnings · no console.log/debug statements · no placeholder/
lorem-ipsum content · no hardcoded dev credentials · entry points clean, no dev/test screen wired as
production entry · no cross-app asset/file reference mixups.

---

## Donor App (`apps/mobile-donor`)

**Configuration** — 🟢. `app.json`: name `Wafina Doador`, bundle ID `com.zuinder.wafina.doador` (iOS +
Android identical), version `0.0.1`, Expo SDK `57.0.10`, React Native `0.86.2`. iOS build number
(EAS-remote) currently 6, tied to commit `7351d56`. Android versionCode currently shows `26` on EAS's
counter, but **no successful Android build exists at that number** — the last real artifact was from
2026-08-05 at version 21, and a build attempt today failed on quota before producing anything (see
`RC1_FREEZE_AUDIT.md`/prior session notes). This matters for whoever runs the next Android build: don't
assume `26` reflects a real, current binary — it doesn't yet.

**Assets** — 🟢. `assets/`: `icon.png`, `adaptive-icon-foreground.png`, `icon-mark.png`, `splash-mark.png`,
`fonts/` (6 files: Manrope ×4, PlusJakartaSans-600, PlexMono-400) — every file `App.tsx`'s `useFonts()` and
`app.json` reference actually exists on disk, correct casing, valid PNG (confirmed via `sips` reading
dimensions successfully on every file — a corrupt file would fail that read).

**Environment/API** — 🟢. `EXPO_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID` and
`EXPO_PUBLIC_API_BASE_URL` (names only, not values). `eas.json`'s `preview` **and** `production` profiles
both hardcode the real production API (`https://wafina-api-rd0q.onrender.com`, HTTPS) — no localhost/
127.0.0.1 in any build-reachable config. The one `'http://localhost:4000'` in `src/lib/api.ts` is a
local-dev-only fallback that never fires in a real build (the env var is always set in every EAS profile) —
already verified this exact point in an earlier phase of this session.

**Firebase/Notifications** — see the shared table below (identical for both apps).

**Dependencies** — 🟡. See Warning #1/#2 above.

**TypeScript/Tests** — 🟢 `tsc --noEmit` clean. 🟡 no test suite (project-wide, not Donor-specific).

**Production readiness** — 🟢. No debug/placeholder content; `__DEV__` used exactly once (gates a
developer-only country simulator in `SettingsScreen.tsx`, correctly excluded from production builds).

---

## Institution App (`apps/mobile-institution`)

**Configuration** — 🟢. `app.json`: name `Wafina Instituição`, bundle ID `com.zuinder.wafina.instituicao`
(iOS + Android identical), version `0.0.1`, same Expo SDK/RN versions as Donor. iOS build number currently
5, same commit. Android versionCode shows `11` on EAS's counter — same caveat as Donor: last real artifact
was 2026-08-05, today's attempt failed before producing anything.

**Assets** — 🟢. Same structure as Donor, all files present, correct casing, valid PNGs, fonts match.

**Environment/API** — 🟢. Same variable names, same production API URL, same no-localhost guarantee.

**Firebase/Notifications** — see table below.

**Dependencies** — 🟡. Warnings #1/#2 above are specific to this app (older patch pins, no
`react-native-web`).

**TypeScript/Tests** — 🟢 `tsc --noEmit` clean, `eslint` clean.

**Production readiness** — 🟢. Same clean result as Donor; no `__DEV__`-gated code in this app at all.

---

## Firebase/Notifications — classified

| Item | Classification |
|---|---|
| Firebase project ID identical both apps (`wafina-98a3a`) | **DEFINITELY CORRECT** |
| Firebase API key/authDomain/appId identical both apps | **DEFINITELY CORRECT** |
| No `google-services.json`/`GoogleService-Info.plist` in either app | **DEFINITELY CORRECT** — both apps use the Firebase **JS SDK** (`"firebase": "^12.16.0"`), not `@react-native-firebase/*`. Native config files are only required for the native-module SDK; the JS SDK is configured entirely via the `EXPO_PUBLIC_FIREBASE_*` env vars already verified above. Their absence is correct, not a gap. |
| Firebase Auth doesn't require bundle-ID-to-project binding (JS SDK architecture) | **DEFINITELY CORRECT** |
| `expo-notifications` / push config absent from both apps | **DEFINITELY CORRECT** — intentional, in-app-only notifications, matches the published Privacy Policy's own claims |
| Firebase Auth actually authenticating correctly inside an installed native build | **NEEDS REAL BUILD VERIFICATION** — inherent limit of any static audit; risk is low given extensive prior live-testing (Expo Go + earlier TestFlight builds this project), but no static check can fully substitute for a real device run |

---

## Cross-App Consistency

| Item | Donor | Institution | Admin | Status |
|---|---|---|---|---|
| Expo SDK | 57.0.10 | 57.0.10 | N/A (web) | 🟢 identical |
| React Native | 0.86.2 | 0.86.2 | N/A | 🟢 identical |
| iOS Bundle ID | `com.zuinder.wafina.doador` | `com.zuinder.wafina.instituicao` | N/A | 🟢 unique |
| Android Package | `com.zuinder.wafina.doador` | `com.zuinder.wafina.instituicao` | N/A | 🟢 unique |
| App Name | Wafina Doador | Wafina Instituição | Wafina Admin (web) | 🟢 clear |
| Version | 0.0.1 | 0.0.1 | 0.0.1 | 🟡 unbumped, all three, not a build blocker |
| API configuration | prod URL, HTTPS | prod URL, HTTPS | prod URL (web env) | 🟢 consistent |
| Firebase | wafina-98a3a | wafina-98a3a | wafina-98a3a | 🟢 identical |
| Notifications | none (in-app only) | none (in-app only) | N/A (staff tool) | 🟢 consistent, intentional |
| Authentication | Firebase Auth (JS SDK) | Firebase Auth (JS SDK) | Firebase Auth (JS SDK) | 🟢 identical pattern |
| Icon | Pink + heart (role-specific) | Blue + people (role-specific) | separate web favicon system | 🟢 correctly differentiated |
| Splash | Pink background | Blue background | N/A (no splash concept for web) | 🟢 correctly differentiated |

No evidence of configuration copied incorrectly between apps — every place the two differ (bundle ID,
package, name, icon/splash color, dependency patch versions) is either intentional and correct, or a minor
drift already listed as a Warning, not a copy-paste error.

---

## Exact Files Requiring Attention

1. **`apps/mobile-institution/package.json`** — `expo-image-picker: ~57.0.6`, `expo-location: ~57.0.6`
   (Donor has `~57.0.7` for both). *Why it matters:* harmless today, avoidable drift. *Suggested change:*
   bump both to `~57.0.7` next time dependencies are touched — not urgent, not applied here.
2. **`apps/mobile-institution/package.json`** — no `react-native-web` dependency (Donor has it). *Why it
   matters:* `expo start --web` won't work for Institution; irrelevant to native builds. *Suggested
   change:* add only if browser-based dev testing of Institution becomes wanted.
3. **`apps/mobile-donor/app.json` and `apps/mobile-institution/app.json`** — no `scheme`, no
   `runtimeVersion`/`updates`. *Why it matters:* no deep linking, no OTA update channel. *Suggested
   change:* none needed for RC1; revisit if deep links or EAS Update are ever wanted.
4. **Both `app.json`** — `"version": "0.0.1"`. *Why it matters:* stores conventionally expect a "real"
   first version. *Suggested change:* bump to something like `1.0.0` before actual store submission — not
   before a build.

None of these were changed. None block a native build.

---

## Recommended Fixes

**MUST FIX BEFORE BUILD:** none.

**SHOULD FIX BEFORE BUILD:** none strictly required. Optional: align the two dependency patch versions
(item 1) for cleanliness.

**CAN WAIT UNTIL AFTER BUILD:** version number bump (needed before store submission specifically), adding
`react-native-web` to Institution (only if web testing is wanted), `scheme`/`runtimeVersion` setup (only if
deep links/OTA updates are wanted later), the pre-existing test-suite gap (large, already-tracked item, not
new).

---

## FINAL VERDICT

# 🟢 READY FOR NATIVE BUILD

No critical issues found in either mobile app. The Warnings above are real but none are build blockers —
they're cleanliness/consistency items and pre-submission (not pre-build) to-dos.

---

## FINAL QUESTION

**Are the current icon and splash configurations technically ready for a future native build, even though
they cannot be properly previewed in Expo Go?**

**Yes.** Both are fully spec-compliant — correct dimensions, correct alpha-channel presence/absence per
platform's actual requirement (Apple rejects alpha on `icon.png`, Android's adaptive foreground needs it —
both confirmed correct), correct Android adaptive-icon foreground/background layer separation, verified
safe-zone math (every glyph element inside Android's ~66.7% guaranteed-visible zone), and a verified
composite-vs-flat pixel match (max 1/255 channel difference across all 4,194,304 pixels, both apps) —
and correctly wired into both `app.json` files. Expo Go's inability to preview them is a limitation of
Expo Go itself (it always renders its own generic icon/splash, never a project's actual config, for any
Expo project) — it says nothing about whether this project's configuration is correct, and nothing found
in this audit suggests it isn't.
