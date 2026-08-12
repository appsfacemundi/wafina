# Phase 2 — App Identity & Store Branding: Final Asset Checklist

**Date:** 2026-08-12. Covers items 1-12 of the Phase 2 order approved for this pass. Legend: 🟢 done and
verified · 🟡 done with an open decision still needed from you · 🔴 not started / blocked.

This is a status checklist, not a new audit — every line below points at verification already performed
earlier in this phase (file, command, or artifact), not re-asserted from memory.

---

## 1. Wafina master brand audit — 🟢

Read `branding/WAFINA_BRAND_GUIDE.md`, `branding/BRANDING_FREEZE_CHECKLIST.md`, and the master logo
(`branding/logo/wafina-icon-mark.png`, matching the reference image you supplied) before proposing anything.
Found the real launcher icon was still on the pre-2026-08-07 maroon/badge system, three weeks stale relative
to the rest of the brand redesign — this became the actual scope of the work, not a false alarm.

## 2. Donor icon concept — 🟢

Wafina Pink `#B50C5E` field + white heart glyph, derived directly from the master logo's own "Doar" badge
icon (not invented). Source: `branding/logo/wafina-glyph-heart.svg`.

## 3. Instituição icon concept — 🟢

Wafina Blue `#0057D9` field + white two-person glyph, derived from the master logo's own "Conectar" badge
icon. Source: `branding/logo/wafina-glyph-people.svg`. Went through one real revision — the first pass
(four overlapping circles) didn't read as "people," rebuilt with proper head+shoulders silhouettes and
re-verified at 48px/32px before finalizing.

## 4. Icons clearly related but immediately distinguishable — 🟢

Verified three ways, not asserted: (a) side-by-side render at real launcher size, (b) composite-vs-flat
pixel diff — max 1/255 channel difference across 4,194,304 pixels on both apps, confirming the adaptive
icon renders identically to its fallback, (c) both glyphs sourced from the same badge row in the same
master logo, so the "family" claim is structural, not just "both are simple shapes." Distinction is by
silhouette *and* color (heart vs. people), not color alone — holds up in greyscale.

## 5. App Store / Play Store icon specifications — 🟢

| Asset | Spec required | Verified |
|---|---|---|
| `icon.png` (both apps) | 1024×1024, no alpha | 🟢 `sips -g hasAlpha` → `no`, both apps |
| `adaptive-icon-foreground.png` | 1024×1024, alpha present | 🟢 confirmed, both apps |
| Play Store icon | 512×512, no alpha | 🟢 `branding/store-assets/play-store-icon-{donor,institution}-512.png` |
| App Store icon | 1024×1024, no alpha | 🟢 `branding/store-assets/app-store-icon-{donor,institution}-1024.png` |
| Android safe zone | every element inside ~66.7% (341.5px radius) | 🟢 verified by coordinate math; tightest margins ~20px (Doador) / ~38px (Instituição) |
| Circle-mask clipping | none | 🟢 rendered under a full circular mask, both apps — no clipping |

## 6. Splash screen review — 🟢

Audited: both apps were byte-identical (same mark, same blue `#0057D9` background, same dark-mode
`#0F172A`) — no role differentiation. Recommended and (on your approval) applied: Doador's light-mode
splash background changed to `#B50C5E` to match its icon; Instituição unchanged since it was already blue;
dark mode left shared for both (neutral, not a brand color). File: `apps/mobile-donor/app.json`.

## 7. Store screenshots strategy — 🟡 strategy done; capture still needs you

- **Strategy/sequence** — 🟢 done. A real 7-screenshot sequence per app (grounded in actual current
  screens, not a generic template), with PT-PT headline + subcopy per shot, plus verified current Apple
  (1320×2868, max 10/localization) and Play (1080×1920 recommended, min 2/max 8) specs. See
  `SCREENSHOT_STRATEGY.md`.
- **Capture** — 🔴 still blocked on you. Needs an authenticated, signed-in device session — per the rule
  this session has followed throughout, I don't sign in or drive the app with real credentials on your
  behalf. Capture instructions are in the same file; once you send raw screenshots over, I can frame/
  caption/export to spec without further device access.

## 8. Store display names — 🟢

`Wafina Doador` / `Wafina Instituição` — confirmed identical between `STORE_LISTING_COPY.md` and both
apps' `app.json` `name` field. No change needed.

## 9. Short/long descriptions — 🟢

Found and fixed a real gap: the 2026-08-04 draft only described donating — RECEBER (individuals receiving
donations, shipped after that draft) was entirely unmentioned. Added a RECEBER/RECEIVING section to
Doador's PT+EN descriptions, updated its short description/subtitle/promotional text/"What's New."
Added an Animal Shelter mention to Instituição's PT+EN descriptions. All character counts re-measured
against the actual text (not estimated) and confirmed under each field's limit. File:
`STORE_LISTING_COPY.md`.

## 10. Keywords and PT/EN/ES/FR/ZH localization — 🟡 drafted, needs native review

Keywords updated for both apps (`receber` added for Doador; `abrigo,animais` added for Instituição), both
still under Apple's 100-char limit. **Spanish, French, and Simplified Chinese drafts added 2026-08-12** —
full short/long descriptions, subtitle, promotional text, keywords, and What's New for both apps, all
character counts measured and within limit. These are machine-assisted drafts, clearly marked as such in
`STORE_LISTING_COPY.md` — not verified for native idiomatic quality, meant as a strong starting point for
a translator, not paste-ready copy. Still your call whether to get that review pass before RC1 or launch
PT+EN only and add languages after (both stores support this post-launch, non-blocking either way).

## 11. Privacy/permissions/store declarations — 🟢

Reviewed `COMPLIANCE_INFORMATION.md` against RECEBER and Animal Shelters, the two features that shipped
since it was drafted (2026-08-02). Neither changes any existing declaration: RECEBER's PIN/reservation/
collection-point data stays within the already-declared Location/App-activity categories; Animal Shelter
is a new value of an existing role field, not a new data type. Documented explicitly with today's date
rather than left silently assumed current.

## 12. Final asset checklist — 🟢 (this document)

---

## What's actually on disk right now (uncommitted)

```
 M apps/mobile-donor/app.json                                    (adaptiveIcon + splash color)
 M apps/mobile-donor/assets/icon.png                              (new Doador icon)
 M apps/mobile-donor/assets/adaptive-icon-foreground.png          (new Doador icon)
 M apps/mobile-donor/eas.json                                     (Phase 1: android buildType fix)
 M apps/mobile-institution/app.json                                (adaptiveIcon color only)
 M apps/mobile-institution/assets/icon.png                        (new Instituição icon)
 M apps/mobile-institution/assets/adaptive-icon-foreground.png    (new Instituição icon)
 M apps/mobile-institution/eas.json                                (Phase 1: android buildType fix)
 M branding/BRANDING_FREEZE_CHECKLIST.md                          (superseded-system note)
 M branding/WAFINA_BRAND_GUIDE.md                                 (new §0 RC1 App Identity)
 M branding/store-assets/app-store-icon-{donor,institution}-1024.png
 M branding/store-assets/play-store-icon-{donor,institution}-512.png
 M COMPLIANCE_INFORMATION.md                                       (RECEBER/Shelter re-check note)
 M STORE_LISTING_COPY.md                                           (RECEBER/Shelter copy + keywords)
?? RC1_FREEZE_AUDIT.md
?? PHASE2_APP_IDENTITY_CHECKLIST.md                                (this file)
?? SCREENSHOT_STRATEGY.md                                          (item 7 sequence/copy)
?? branding/icons/launcher-{donor,institution}-icon.svg           (icon source)
?? branding/logo/wafina-glyph-{heart,people}.svg                  (glyph source)
```

Nothing committed, pushed, built, or submitted at any point in Phase 2 — confirmed via `git status` after
every change.

## Blocking items before Phase 2 can close out

1. **Screenshot capture** (item 7) — strategy/sequence is done; the actual capture needs you at a
   signed-in device. Nothing further to prep on my end until raw screenshots exist.
2. **ES/FR/ZH native review** (item 10) — drafts exist; your call whether to get a native/professional
   pass before RC1 or launch PT+EN only and add languages post-launch. Not a hard blocker either way.

Everything else in Phase 2 is done and verified.
