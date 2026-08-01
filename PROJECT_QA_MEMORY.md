# WAFINA V1 PROJECT MEMORY

## Project Overview

Wafina — donation-matching platform connecting individual/corporate donors with verified
institutions (NGOs, orphanages, churches, schools) across Portuguese-speaking African countries.

**Architecture:** Monorepo (npm workspaces).
- `apps/api` — Express backend, single source of truth for all business logic.
- `apps/web` (Donor), `apps/institution`, `apps/admin` — Next.js web apps.
- `apps/mobile-donor`, `apps/mobile-institution` — Expo SDK 57 / React Native 0.86 (New
  Architecture on by default).
- `packages/shared` — shared TS types/enums, built to `dist/` (rebuild after changing).

**Backend:** Google Sheets is the production database (`apps/api/src/config/sheets.ts`,
tab names in `apps/api/src/config/sheet-tabs.ts`). Firebase Auth is the separate identity layer
— client signs in/up with Firebase, then calls `POST /auth/session` with the ID token to
bootstrap/resolve the `Users` row.

**Current version:** Pre-launch, Version 1.0 Feature Freeze in effect — no new functionality,
only bug/security/readiness fixes until launch (see `DEVELOPMENT_RULES.md` §16). Any new feature
ideas go to `VERSION_2_ROADMAP.md`. AppSheet is fully deprecated from the architecture — no new
AppSheet logic/Bots/APIs.

**Project status:** Backend/Web/Admin previously certified production-ready. Android mobile
verification COMPLETE. iOS mobile verification IN PROGRESS (this file tracks it).

---

## Production Status

- **Android:** ✅ Verified production-ready (commit `e4b8707`, recorded `bc486a1`). Donor +
  Institution apps, full donation lifecycle, photo upload, auth flows all live-tested against
  production backend.
- **iOS:** 🔶 IN PROGRESS. Donor app core flows verified this session (see below). Institution
  app verification started but not finished (claim/schedule/collect/deliver/success-story/logo
  upload not yet tested).
- **Web (Donor/Institution/Admin):** ✅ Previously certified.
- **Backend:** ✅ Production-hardened (rate limiting, structured logging, Sheets backup, see
  `ee137f3`).
- **Admin:** ✅ Full feature parity with Donor/Institution (Users, Countries, Disputes,
  Corporate Accounts + invitation codes, Notifications broadcast, Reports) — see commits `52`
  through `57` in git log for the phased build-out.

---

## Completed Modules

- Authentication (sign up / sign in, Firebase + `/auth/session` bootstrap) — Android ✅, iOS
  Donor ✅ (sign-up + suspended-account sessionError path verified live).
- Donation creation + photo upload (`uploadFile()` via `expo-file-system/legacy` uploadAsync) —
  Android ✅, iOS Donor ✅ (real 201, real Drive URL, GPS auto-capture confirmed).
- Institution registration (pending-verification flow) — iOS ✅ (this session).
- GPS/location auto-capture — Android ✅, iOS Donor ✅, iOS Institution ✅ (registration form).
- Camera/photo picker — Android ✅ (photo library only, camera not tested), iOS Donor ✅ (photo
  library only, camera not tested).
- Admin Web full CRUD across Users/Countries/Disputes/Corporate Accounts/Notifications/Reports —
  ✅ (web only, not applicable to mobile).

**Not yet verified on iOS:** Institution claim → schedule → collect → deliver workflow, Success
Story creation with photo upload, Institution logo upload, Notifications (mobile push/in-app),
offline/poor-network behavior on iOS specifically.

---

## Bugs Fixed

| Date | Bug | Root Cause | Files changed | Commit |
|---|---|---|---|---|
| 2026-07-31 | Donation photo upload silently failed on Android (`Unsupported FormDataPart implementation`, then `undefined is not a function` after first fix attempt) | RN 0.86 New Architecture breaks classic `FormData`/`Blob` multipart upload | `apps/mobile-donor/src/lib/api.ts`, `apps/mobile-institution/src/lib/api.ts` (new `uploadFile()` using `expo-file-system/legacy` `uploadAsync`), `DonateScreen.tsx`, `SettingsScreen.tsx`, `NewSuccessStoryScreen.tsx` | `e4b8707` |
| 2026-07-31 | Silent auth failure: a session-resolution error (e.g. suspended account) left the app stuck instead of showing Sign In | `AuthContext`'s `onAuthStateChanged` listener didn't catch/report `resolveSession()` failures | `AuthContext.tsx` + `SignInScreen.tsx` in both mobile apps (added `sessionError` state, `signIn()` rethrow-and-signOut) | `e4b8707` |

---

## Remaining Bugs

| Priority | Description | Module | Status |
|---|---|---|---|
| Low / Unconfirmed | Donor Home screen "Sair" (sign out) button did not respond to 7+ tap attempts (varied coordinates, `tap` and `touch_path`) during iOS Simulator automation. The underlying `signOut(firebaseAuth)` call itself IS verified working (proven via the suspended-account forced-signout test, which hit the exact same code path and correctly landed back on Sign In with the error banner). This may be a simulator-automation tap-registration artifact rather than a real app bug — every other button on the same screen/app responded normally. **Needs a live human tap test on a real device or fresh simulator session to confirm or refute before treating as a real bug.** | Donor mobile (iOS) | Unconfirmed, not fixed |
| Medium / Unconfirmed | Institution `SignUpScreen` "Criar conta" button produced **zero server signal** (no `POST /auth/session`, ever) across 5 consecutive attempts this session — including after a full component state reset (navigated to SignIn and back, confirming empty fields) with a short, cleanly-typed email/password. Unlike the email-field typing quirk (below), this specifically means the button press itself may not be registering, OR Firebase's `createUserWithEmailAndPassword` is silently failing/hanging client-side with no visible error (not confirmable without a screenshot, which was intentionally not spent here per stakeholder direction to stop and preserve the finding instead of continuing to guess). Institution's own "Sair" button, by contrast, DID work correctly on the first tap this same session (see Session Notes) — so this is not the same broad class of issue as the Donor "Sair" bug; it appears specific to `SignUpScreen`'s submit path. **Needs a live human/device retest of Institution sign-up specifically before treating as a real app bug.** | Institution mobile (iOS) | Unconfirmed, not fixed — blocked further progress on direct logo-upload-path testing this session |

---

## Known Technical Decisions

- **iOS Simulator automation quirks (tooling, not app bugs):**
  - The `@` character sometimes renders as `"` or as a bare digit (e.g. `2`) when typed via the
    simulator control tool — this is a modifier-key race condition in the tool itself (confirmed
    independent of both the Mac's keyboard layout and the simulated device's own keyboard
    settings). It is probabilistic — simply retrying the same `@` keystroke until it renders
    correctly works reliably.
  - Multi-character strings occasionally drop characters mid-string (a separate, unrelated
    race). Work around by re-typing the missing suffix after checking a screenshot.
  - Tap/swipe coordinates for this tool are in **device points**, not screenshot pixels. For the
    iPhone 17 Pro Max, device space is 440×956pt; screenshots render at roughly 2.09× that, so
    divide any pixel measurement read visually by ~2.09 before passing to `tap`/`swipe`.
  - Clipboard paste via `simctl pbcopy` + long-press-menu does NOT work through this automation
    tool (the system paste popover doesn't respond to synthetic taps) — don't rely on it as a
    workaround for the `@` issue; retry-typing is the reliable method.
- Google Sheets has real rate limits — hit once during rapid test traffic earlier in the
  project. Avoid large automated batch operations against it.
- Admin Web App is permanently first-class (`DEVELOPMENT_RULES.md` §15) — every new Donor/
  Institution feature needs an Admin-side counterpart. (Not relevant to pure QA/bugfix work
  under the current feature freeze.)
- **XCTest/XCUITest migration — evaluated, NOT implemented.** Stakeholder asked for a feasibility
  assessment (this session) to replace screenshot-heavy manual QA with accessibility-identifier-
  driven XCUITest. Key finding: requires switching from Expo Go to a custom dev client
  (`expo prebuild` / `eas build --profile development`), since Expo Go's fixed binary can't host
  a custom XCTest target. Recommended as a post-V1 QA-infra investment, not a V1-blocking change
  (see full write-up in chat history this session for the phased rollout plan). No code/config
  changed as a result of this evaluation.

---

## QA Progress

| Module | Certified | PASS/FAIL | Commit |
|---|---|---|---|
| Android — Donor app full lifecycle | 2026-07-31 | PASS (after fix) | `e4b8707` |
| Android — Institution app full lifecycle | 2026-07-31 | PASS | `e4b8707` |
| iOS — Donor: sign up, session bootstrap | This session | PASS | not yet committed |
| iOS — Donor: donation + photo upload | This session | PASS | not yet committed |
| iOS — Donor: suspended-account / sessionError flow | This session | PASS | not yet committed |
| iOS — Donor: Sair (sign out) button | This session | UNCONFIRMED (see Remaining Bugs) | — |
| iOS — Institution: sign up + registration | This session | PASS | not yet committed |
| iOS — Institution: claim → schedule-collection → collect → deliver | This session | PASS (all 4 API calls returned 200, verified via server log) | not yet committed |
| iOS — Institution: post-delivery "Criar História" alert → success story creation (title/description/photo) | This session | PASS (POST /success-stories → 201, verified stored Title/Description/Image/Status=Pending via Sheets read) | not yet committed |
| iOS — Institution: logo upload — locked-field change-request path | This session | PASS (POST /change-requests -> 201, verified Field_Requested="Logo", Reason text, Status=Pending via Sheets read) | not yet committed |
| iOS — Institution: logo upload — direct picker-upload path (PATCH /institutions/me/logo) | Blocked this session (see Remaining Bugs — new-institution sign-up never completed; "Criar conta" produced no server signal across 5 attempts) | — | — |
| iOS — Notifications (mobile) | Not started | — | — |
| iOS — Offline/poor-network behavior | Not started | — | — |

---

## Current Branch

- Branch: `main`
- Latest commit: `bc486a1` — "Record Android verification round commit hash in PROJECT_STATUS.md"
- Working tree: clean as of start of this iOS session (no uncommitted app-code changes yet —
  all iOS work so far has been live-testing against already-committed code, not new edits).

---

## Next Module To Audit

**iOS — Institution app: retry direct logo-upload picker path (new institution sign-up), then
Notifications, then offline/poor-network behavior.**

Logo-upload change-request path (locked-field flow) is PASS. The direct picker-upload path
(`PATCH /institutions/me/logo`) is still untested — this session's attempt to create a second,
unverified test institution was blocked by the Institution `SignUpScreen` "Criar conta" button
producing no server signal after 5 attempts (see Remaining Bugs — needs a live human/device
retest before assuming it's a real app bug, since it may be simulator-automation-specific like
the Donor "Sair" issue). **IMPORTANT — current app state:** the simulator is currently signed
OUT (mid a failed sign-up attempt on a garbled `SignUpScreen`). To resume other Institution
modules (Notifications, offline), first sign back in with the original verified test account:
`wafi.inst.test@gmail.com` / `TestPass123`. Donor iOS "Sair" button also remains Unconfirmed (see
Remaining Bugs) — still needs a live human/device re-test.

---

## iOS Simulator Calibration (reuse — do not recalibrate unless UI changes)

**Device:** iPhone 17 Pro Max, device space 440×956pt, screenshot scale ≈2.09x.

**Institution app bottom tab bar** (6 tabs, evenly spaced, y≈900pt device points; x = column center):

| Tab | Label | Device coords (x, y) |
|---|---|---|
| 1 | Início (Home) | (37, 900) |
| 2 | Disponíveis (Available Donations) | (110, 900) |
| 3 | Aceites (Claimed By Me) | (183, 900) |
| 4 | Ocorrências (Disputes) | (257, 900) |
| 5 | Notificações | (330, 900) |
| 6 | Definições (Settings) | (403, 900) |

Note: the Expo dev-menu overlay ("Wafina Instituição / SDK version.../ Continue" card) can pop up
unexpectedly (observed twice this session, cause unclear — possibly a stray shake/two-finger
gesture from automation) and blocks the tab bar entirely. If a tap silently fails to navigate,
check for this overlay first (Continue button ≈ device (220, 568); X close ≈ device (400, 451))
before assuming a real app bug.

**Institution "Aceites" (Claimed By Me) card — single-item layout, action button position:**
For a card with 1 status line + short 4-stage timeline (Aceite/Recolha Agendada/Recolhida/
Entregue) and no Expected_Collection/Delivery_Date line yet: primary status-action button
("Confirmar recolha agendada" / "Marcar como recolhida" / "Confirmar entrega", same slot,
same position since only one shows at a time per status) ≈ device (167, 540). "Comunicar
Ocorrência" ghost button just below it ≈ device (151, 590). These will shift down if
Expected_Collection_Date/Expected_Delivery_Date lines are present (extra ~20-24pt each) —
recheck with a screenshot if a tap at these coordinates doesn't produce the expected API log
line.

**Institution "NewSuccessStory" form (`NewSuccessStoryScreen.tsx`) — device coords:**
Título input (220, 224) · Descrição input (220, 322) · "Escolha uma fotografia" well (220, 411).
**After a photo is attached, the layout shifts** (well replaced with a 200pt-tall preview image +
a new "Escolher outra fotografia" secondary button): "Escolher outra fotografia" ≈ (220, 654) ·
**Publicar (post-photo) ≈ (220, 710)** — do not reuse the pre-photo y=481 estimate, it now lands
on "Escolher outra fotografia" instead and silently reopens the photo picker (no error, no log —
only visible via screenshot or a missing `POST /success-stories`).

**Native photo-library picker quirk:** the first tap on a grid thumbnail sometimes doesn't
register/close the picker (same class of flakiness as the documented paste-menu issue) — the
grid stayed open silently through one full tap+wait cycle. Retry the same thumbnail tap once;
it succeeded on retry both times this session.

**Institution "SettingsScreen.tsx" — Logo section + change-request form, device coords:**
Definições tab lands here directly. Logo section sits at the very top of the first Card. IMPORTANT:
once an institution is Admin-verified, ALL profile fields (`Name, Type, Location, Needs_List,
Logo` — `ALL_PROFILE_FIELDS` in `apps/api/src/services/institutions.ts`) auto-lock, per spec
4.2.4 — the direct "Adicionar/Alterar logótipo" picker button is replaced by a locked-field
message, and the only reachable path is "Solicitar alteração" (change request). This is correct,
designed behavior, not a bug — do not re-flag it.

Change-request form (second Card): native `@react-native-picker/picker` wheel for "Campo"
(options in fixed order Selecione/Nome/Tipo/Localização/Itens Necessários/**Logótipo** — Logo is
always last). To select Logótipo from the default "Selecione..." position: `touch_path` drag from
device (220, 650) to (220, 490) — a 160pt upward drag (5 rows × 32pt native row height) — lands
exactly on Logótipo (confirmed via Sheets read, no retry needed). Motivo textarea ≈ (220, 735).
Dismiss keyboard by tapping the screen title ≈ (220, 78) before tapping Enviar pedido (this screen
uses `KeyboardAvoidingView`, so the button shifts while the keyboard is open). Enviar pedido ≈
(220, 814) — confirmed correct with keyboard dismissed first.

**Not yet tested:** the direct `PATCH /institutions/me/logo` picker-upload code path
(`onPickLogo` in `SettingsScreen.tsx`) only runs when Logo is NOT in `Locked_Fields` — i.e. only
reachable with a freshly-registered, not-yet-Admin-verified institution. The current disposable
test institution is already verified, so this path could not be exercised without creating a
second, separate test account. Uses the same `uploadFile()` helper already proven working on iOS
for donation photos and Success Story photos this session, so an iOS-specific bug here is
unlikely but not directly confirmed.

**Known simulator quirk:** emoji (📍 location pin, 📅 calendar) render as boxed "?" placeholder
glyphs in the iOS Simulator on this machine — a Simulator font-fallback limitation, not an app
bug. Real devices render these emoji normally.

**Severe text-input unreliability on Institution `SignUpScreen` email field (this session):** a
plain, full-string `text` action on an EMPTY field dropped 18 of 25 characters on the first
attempt. Chunked re-typing (4-char bursts) to append the missing suffix made it worse — later
diagnosis showed characters landing out of order / mid-string rather than cleanly appended,
suggesting the tap used to "resume" a partially-filled field does not reliably place the cursor
at the end every time. `\b` (backspace) is NOT interpreted as a delete keystroke by this tool —
it types the literal two characters `\` and `b`. There is no working clear/select-all mechanism
via this tool for a populated text field. **The only confirmed reliable way to reset a text field
is to navigate away from the screen and back** (unmounting/remounting resets local React state
to `''`) — this worked cleanly for `SignUpScreen`. Even after that clean reset, submitting a
short, correctly-typed email+password produced no server signal at all (see Remaining Bugs) —
this second issue is unrelated to the typing quirk and remains unresolved.

**Institution "Sair" (sign-out) button worked correctly on the first tap this session** — unlike
the Donor app's unconfirmed "Sair" issue, this is not evidence of a systemic sign-out-button bug
across the platform.

---

## Files Frequently Used

- `apps/mobile-institution/src/context/AuthContext.tsx` — sessionError/signIn logic.
- `apps/mobile-institution/src/lib/api.ts` — `uploadFile()` (logo, success story photo).
- `apps/mobile-institution/src/screens/SettingsScreen.tsx` — logo upload UI.
- `apps/mobile-institution/src/screens/NewSuccessStoryScreen.tsx` — success story + photo upload.
- `apps/api/src/services/institutions.ts` — `verifyInstitution()` and related backend logic.
- `apps/api/src/services/donations.ts` — claim/schedule/collect/deliver state transitions.
- `apps/api/src/config/sheet-tabs.ts` — `SHEET_TABS` constant (correct import path; NOT exported
  from `sheets.ts` itself).

---

## Important Commands

**Boot/attach the iOS Simulator (only one device should be booted to avoid ambiguity):**
```
xcrun simctl list devices | grep -i booted
xcrun simctl shutdown <extra-device-udid>
xcrun simctl boot <target-udid>
```
Target device this session: iPhone 17 Pro Max, `BCD006C4-ADC9-41F0-9350-0081AC2B92C3`.

**Start Expo dev server pointed at the simulator (kill any other app's server on 8081 first):**
```
cd apps/mobile-institution && nohup npx expo start --ios > /tmp/expo-institution-ios.log 2>&1 &
```

**Force Expo Go to reload a specific project without re-picking from the launcher:**
```
xcrun simctl terminate <udid> host.exp.Exponent
xcrun simctl openurl <udid> "exp://192.168.1.138:8081"
```

**Run API server locally with captured logs:**
```
cd apps/api && nohup npx tsx watch src/index.ts > /tmp/api-ios-test.log 2>&1 &
curl -s http://localhost:4000/health
```

**One-off Sheets scripts (write to `apps/api/scripts/tmp-*.ts`, run via `npx tsx`, delete
immediately after):**
```ts
import { getRows, updateRow } from '../src/config/sheets';
import { SHEET_TABS } from '../src/config/sheet-tabs'; // NOT from sheets.ts
```
`updateRow(tab, keyColumn, keyValue, patch)` — 4 args, not a predicate function.

---

## Session Notes

**Disposable test accounts created this session (NOT yet cleaned up):**
- Donor: `wafi.donor.test@gmail.com` / `TestPass123`, User_ID
  `06426704-1738-486c-b789-43e98526bf5d`, Status currently `Active` (was briefly `Suspended` to
  test the sessionError fix, then reactivated).
- Institution: `wafi.inst.test@gmail.com` / `TestPass123`, Institution_ID
  `2b89b41e-7d35-46eb-8b37-714d77414c25`, Name "IOS Test Inst", Verification_Status now
  `Verified` (manually approved via a one-off script call to `verifyInstitution()` since Admin
  approval normally takes days).
- One donation created and left in place: Donation_ID `790d0cc9-20dd-4240-aeb4-286f09b99b8e`,
  Public_Donation_Code `AO-000031`, Status `Pending`, real Google Drive photo URL attached.

**Cleanup still owed before final commit:** delete/reset the above test rows from `Users`,
`Institutions`, and `Donations` sheets, and delete the Firebase Auth accounts, matching the
discipline used at the end of the Android verification round.

**Per user instruction (this session):** adopt the strict QA operating procedure below for all
future work on this project until V1 is certified — one module per session, memory-file-driven
(read this file first, not chat history), minimize screenshots/full-repo scans/log dumps, ask
before high-cost actions, stop and report after each module instead of chaining work.
