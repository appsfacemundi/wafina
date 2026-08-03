# Wafina Branding Freeze — Final Verification & Checklist

**Date:** 2026-08-03. This is the final verification pass before Version 1.0 branding is treated as frozen.

---

## 1. Rendering Verification — Method & Results

Two things were checked, not just re-eyeballed: **what's actually wired into the apps** (not the draft
source files), and **actual technical compliance issues**, not just visual appearance.

| Context | Verified how | Result |
|---|---|---|
| Android adaptive icon | Pixel-diffed the real composite (`backgroundColor` + `adaptiveIcon.foregroundImage`, as Android will actually render it) against the flat fallback icon | **0 pixel difference** across all 1,048,576 pixels, both apps — no positional drift between the two icon representations |
| Android launcher (circle mask) | Rendered under a real circle clip at 108px, in a launcher-row mockup | No clipping; badge fully visible |
| Android — squircle / rounded-square masks | Rendered under both alternate mask shapes real launchers use (not just circle) | No clipping under either — this is what the safe-zone math in the Brand Guide was actually built to guarantee, now confirmed rather than assumed |
| iPhone Home Screen (squircle) | Rendered under iOS's superellipse-approximated mask in a home-screen-row mockup | No clipping; badge fully visible |
| Google Play icon | Rendered in a Play-listing-style circle presentation | Correct; **found and fixed a real compliance gap**: no dedicated 512×512 Play listing icon export existed as its own file — see §3 |
| Apple App Store icon | Rendered in a squircle listing presentation | Correct visually — **found and fixed a real technical defect**: `icon.png` for both mobile apps carried an alpha channel. Apple App Store Connect rejects icon uploads with any alpha channel present, even fully opaque ones. Fixed by flattening to RGB (zero visual change, since it was already 100% opaque) |

## 2. Clipping / Scaling / Padding / Masking Check

- **Clipping:** none found. Badge placement (center + radius) stays fully inside Android's ~67% adaptive-icon
  safe zone under all three real mask shapes — verified by rendering, not just calculating.
- **Scaling:** verified legible from 64px down through 16px (`FINAL-minimum-size-stress-test.png`, built
  from the actual shipped files). Below ~24px the letter itself stops being crisp — expected at that size
  for any icon, not a defect; color + app name carry differentiation below that threshold, which is normal
  platform behavior.
- **Padding:** none found. Icons are full-bleed to the canvas edge (before platform masking), matching both
  Apple's and Google's own guidance not to add artificial margin — the platform's mask provides the visual
  inset, not the source file.
- **Masking:** confirmed via direct pixel-diff (§1) that the Android adaptive-icon composite matches the
  flat fallback exactly — no visual inconsistency between what iOS/legacy-Android show (the flat icon) and
  what modern Android shows (background color + foreground layer composited live).

**No design changes were made as a result of this pass — the two fixes applied (alpha channel, missing
512×512 Play export) are technical/compliance corrections with zero visual difference, not redesigns.**

## 3. Full Branding Asset Inventory

| Asset | Status | Detail |
|---|---|---|
| **Mobile icons — Donor** | ✅ Updated | `apps/mobile-donor/assets/icon.png` (alpha-stripped) + `adaptive-icon-foreground.png`, wired into `app.json` |
| **Mobile icons — Institution** | ✅ Updated | Same, `apps/mobile-institution/` |
| **Mobile icons — Admin** | ➖ Not applicable | No mobile app exists for Admin (web-only) |
| **Web favicon — Donor Web** | ✅ Updated | `apps/web/src/app/icon.png` — new; no favicon existed before this work at all |
| **Web favicon — Institution Web** | ✅ Updated | `apps/institution/src/app/icon.png` — new |
| **Web favicon — Admin Web** | ✅ Updated | `apps/admin/src/app/icon.png` — new |
| **Website logo/mark (all 3 web apps)** | ✅ Updated | `.app-mark-dot` CSS simplified from the old two-color gradient to solid `bougainvillea700` in all three `globals.css` files |
| **Branding documentation** | ✅ Updated | `WAFINA_BRAND_GUIDE.md` (official reference) and `BRANDING_PROPOSAL.md` (decision history) both current and complete |
| **`COLOR_SYSTEM.md`** | ⚠️ Still using previous branding | This was the *first* draft doc, written before the wine/burgundy pivot — it documents the superseded `bougainvillea500` + ring concept. Superseded by `WAFINA_BRAND_GUIDE.md` but not deleted or updated. Flagging rather than silently removing, since you may want it kept as history. |
| **Play Store — app icon (512×512 dedicated export)** | ⚠️ Was missing, now fixed | Found no dedicated store-listing icon file existed; not a design change, just an export gap now closed |
| **Play Store — screenshots** | ⬜ Pending | Do not exist. Needs a real running app on a device/emulator to capture — outside what this environment can produce |
| **Play Store — feature graphic (1024×500)** | ⬜ Pending | Does not exist. Needs illustration/composition work — needs an image-generation tool or designer |
| **App Store — app icon (1024×1024, no alpha)** | ✅ Updated | Same file as the mobile icon, now alpha-compliant |
| **App Store — screenshots** | ⬜ Pending | Same as Play Store — needs a real device/simulator capture |
| **Splash screens** | ⬜ Pending (deliberate) | No `splash` key exists in either `app.json`; still Expo's default. Explicitly out of scope for every round of this branding work per your own repeated instruction, not an oversight |
| **Marketing assets** (social kit, press kit, promo graphics) | ⬜ Pending | None exist. Same tooling limitation as feature graphics |

## 4. Branding Freeze Checklist

| Item | Status |
|---|---|
| Master brand color defined and documented (`bougainvillea700`) | **COMPLETE** |
| Badge system (D/I/A) designed and documented | **COMPLETE** |
| Wordmark — light version | **COMPLETE** |
| Wordmark — dark version | **COMPLETE** |
| Typography rules documented (reusing existing tokens) | **COMPLETE** |
| Icon rules / safe-zone math documented | **COMPLETE** |
| Minimum sizes documented and empirically tested | **COMPLETE** |
| Do's and Don'ts documented | **COMPLETE** |
| Donor App icon wired + verified | **COMPLETE** |
| Institution App icon wired + verified | **COMPLETE** |
| Android adaptive icon (foreground/background layers, not flattened) | **COMPLETE** |
| Android launcher mask compatibility (circle/squircle/rounded-square) | **COMPLETE** |
| iOS Home Screen mask compatibility | **COMPLETE** |
| Apple icon alpha-channel compliance | **COMPLETE** |
| Google Play icon compliance | **COMPLETE** |
| Donor Web favicon | **COMPLETE** |
| Institution Web favicon | **COMPLETE** |
| Admin Web favicon | **COMPLETE** |
| Website brand mark updated to master color | **COMPLETE** |
| In-app UI accent colors updated to match | **NOT APPLICABLE** — explicitly out of scope by your own decision; apps keep `bougainvillea500` |
| `COLOR_SYSTEM.md` reconciled with final direction | **PENDING** — superseded content still present, flagged not fixed |
| Play Store screenshots | **PENDING** — needs a real device/emulator |
| Play Store feature graphic | **PENDING** — needs an image-gen tool or designer |
| App Store screenshots | **PENDING** — needs a real device/simulator |
| Splash screens | **PENDING** — deliberately deferred, not forgotten |
| Marketing / social / press assets | **PENDING** — needs an image-gen tool or designer |

---

## Bottom line

**The icon/logo/favicon/website-mark branding is genuinely ready to freeze — every item in that category is
COMPLETE and was verified against real rendering constraints, not just visual review, and two real
technical defects (Apple's alpha-channel rule, a missing Play Store icon export) were caught and fixed in
this pass.** What remains open (screenshots, feature graphic, splash, marketing kit) was never claimed to be
in scope for this round — freezing the icon/logo identity now does not block on those, and nothing above
requires unfreezing the logo/color decision itself to close them later.
