# Wafina Brand Guide

**Status: PARTIALLY RE-FROZEN — 2026-08-12.** The 2026-08-07 redesign (logo, colors, typography, splash,
auth, navigation) is still the current identity for everything *except* the app launcher icons, which this
update now closes out — see **§0, RC1 App Identity**, the current, authoritative source for both mobile
apps' launcher icons. Everything from §1 onward below that point (Master Logo, Badge System D/I/A,
`#710f44` as the shared master color) describes the identity that was frozen 2026-08-03 and explicitly
superseded 2026-08-07; it remains historical reference only, not a current constraint, and is not restored
by this update.

---

## §0. RC1 App Identity — Launcher Icons (current, approved 2026-08-12)

Two color-differentiated launcher icons, both derived directly from the existing master logo's own
simplified badge iconography (the small "Doar" / "Conectar" / "Transformar" glyph row beneath the full
Wafina mark) — not a new symbol system, and not the maroon/badge system in §1-9 below.

| App | Field color | Glyph | Source |
|---|---|---|---|
| **Wafina Doador** | Wafina Pink `#B50C5E` | White heart (solid) | The master logo's own "Doar" badge glyph |
| **Wafina Instituição** | Wafina Blue `#0057D9` | White two-person mark (solid) | The master logo's own "Conectar" badge glyph |

**Why this pair, not a shared shape recolored:** distinction comes from *silhouette and color together*
(heart vs. people), not color alone on an identical shape — legible even in greyscale, and immediately
distinguishable side by side without reading the app name. Both still read as one Wafina product because
both glyphs come from the same source (the logo's own badge row), both are flat white on a solid brand
color, and both follow the same construction rules below.

**Rules (binding for both apps):**
- Flat fill only. No gradients, bevels, drop shadows, or 3D effects on the glyph or field.
- No letters, no text, no corner badges.
- Full-bleed 1024×1024 square source, uncropped, unmasked — iOS/Android apply their own masking.
- Every glyph element stays inside Android's adaptive-icon safe zone (inner ~66.7% of the canvas, radius
  ≈341.5px from center at 1024×1024) — verified by direct coordinate check for every shape, not estimated.
- `#710f44` (Bougainvillea 700, the old shared master color) is retired **from the launcher icon only** —
  it is not used anywhere in either app's `icon.png`, `adaptive-icon-foreground.png`, or
  `adaptiveIcon.backgroundColor`. It may still appear elsewhere in the codebase outside icon assets; this
  guide does not assert anything about non-icon usage.

**Source files:**
- `branding/logo/wafina-glyph-heart.svg` — heart glyph alone, white on transparent
- `branding/logo/wafina-glyph-people.svg` — two-person glyph alone, white on transparent
- `branding/icons/launcher-donor-icon.svg` — full composite (pink field + heart)
- `branding/icons/launcher-institution-icon.svg` — full composite (blue field + people)

**Wired assets (both apps):**
- `assets/icon.png` — 1024×1024, flat composite, **no alpha channel** (Apple requirement)
- `assets/adaptive-icon-foreground.png` — 1024×1024, glyph only, **alpha channel preserved**
- `app.json` → `android.adaptiveIcon.backgroundColor` — `#B50C5E` (Doador) / `#0057D9` (Instituição)
- `branding/store-assets/play-store-icon-{donor,institution}-512.png` — 512×512, no alpha
- `branding/store-assets/app-store-icon-{donor,institution}-1024.png` — 1024×1024, no alpha

**Verified, not assumed (2026-08-12):**
- Pixel-diffed the Android adaptive-icon composite (background color + foreground layer, rendered exactly
  as Android renders it) against the flat fallback `icon.png` — max channel difference of 1/255 (rounding
  noise only) across all 4,194,304 pixels, both apps. Effectively identical.
- Rendered both icons under a full circular mask (Play Store listing presentation) — no clipping, comfortable
  margin on every element.
- Confirmed via direct coordinate math that every circle/path element in both glyphs stays inside the
  341.5px safe-zone radius, with the tightest margin at ~38px (institution glyph) and ~20px (donor glyph).
- Confirmed `icon.png` has no alpha channel on both apps (`sips -g hasAlpha` → `no`) — the exact defect
  the 2026-08-03 freeze had previously caught and fixed on the old icon; not reintroduced here.

---

**Honesty note, consistent with how this whole process has worked:** everything in this guide is
code-producible (SVG shapes, flat color, `sharp`-rasterized PNGs). There is no image-generation tool in
this environment. Where a real brand asset would need illustration, photography, or refined typography
rendering (a proper Fraunces/WorkSans render, a polished splash composition, App Store screenshots of the
actual running app), that's flagged explicitly below as still needing a design tool or a designer — this
guide does not pretend otherwise.

---

## §1-9 — Historical (superseded 2026-08-07; launcher icons specifically closed out by §0 above)

**Everything from here to the end of this document describes the identity frozen 2026-08-03.** It is kept
for historical reference only. In particular: §1's "master circle," §5's D/I/A badge system, and §3's
`#710f44` master color are **not** the current launcher icon — see §0. Do not use anything below to justify
reverting the launcher icon, and do not treat it as still-binding without checking §0 first.

## 1. Master Logo

The mark is a single circle ("the dot"), rendered solid in the master brand color. It is the same shape,
same proportions, and same color across every Wafina application — this is the one constant that makes the
whole ecosystem read as one product.

`branding/icons/plus-donor-icon.svg` / `.png` (and the Institution/Admin variants) show the mark applied at
full app-icon scale, on the master color field.

## 2. Wordmark

Text "Wafina" (serif, matching the `Fraunces-600` display font already used throughout the product — this
guide's renders use a serif system fallback since Fraunces' actual font file isn't rasterizable in this
environment) paired with the same dot mark, sized to sit as a lowercase-x-height companion to the text, not
dominate it.

- **Light version** (`branding/wordmark/wafina-mark-light.png`) — dark text (`#241a20`) + brand-color dot
  (`#710f44`) on white/light backgrounds.
- **Dark version** (`branding/wordmark/wafina-mark-dark.png`) — white text + a lightened brand-color dot
  (`#e495c0`, the existing palette's `bougainvillea300` step) on dark backgrounds. The dot is lightened
  rather than kept at full `#710f44` specifically because wine-on-near-black has weak contrast — this was a
  judgment call made for legibility, not a stylistic preference.

## 3. Official Color Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| **Master brand color** | Bougainvillea 700 | `#710f44` | The one dominant color across the entire ecosystem — icon backgrounds, wordmark dot (light mode), primary brand surface. Reused from the existing design system, not a new invention. |
| Badge — Donor | Dusk 900 | `#241a20` | Donor's identifier badge only. Neutral, not an "accent" — Donor is the base/flagship identity. |
| Badge — Institution | Palm 500 | `#0f6e5c` | Institution's identifier badge only. |
| Badge — Admin | Info 500 | `#2e6fa3` | Admin's identifier badge only. |
| Dark-mode dot | Bougainvillea 300 | `#e495c0` | Wordmark dot on dark backgrounds only — never used as a surface color. |
| Neutral text (light bg) | Dusk 900 | `#241a20` | Wordmark and body text on light backgrounds. |
| Neutral text (dark bg) | White | `#ffffff` | Wordmark and body text on dark backgrounds. |

**Rule:** the master color never changes per app. Only the small badge changes. This is the entire
mechanism by which Donor/Institution/Admin stay differentiated without fragmenting the brand.

## 4. Typography

Already established in `packages/ui` / every app's `theme/tokens.ts` — this guide doesn't introduce new
typefaces, only confirms their role in brand contexts:

| Token | Font | Brand role |
|---|---|---|
| `fonts.display` | Fraunces-600 | Wordmark, headlines, the "Wafina" name itself |
| `fonts.bodyBold` | WorkSans-700 | Badge letters (D/I/A), UI emphasis |
| `fonts.body` | WorkSans-400 | Body copy |
| `fonts.mono` | PlexMono-400 | Donation codes, IDs — anywhere a monospaced technical reference appears |

## 5. Badge System (D / I / A)

- One solid-filled circle, positioned bottom-right of the icon.
- Contains a single bold, white, centered letter: **D** (Doador), **I** (Instituição), **A** (Admin).
- Badge fill color is the *only* thing that changes between apps (§3).
- Solid fill only — never a stroke/ring (see §9, this was tested and rejected: a thin ring loses legibility
  at real icon sizes and under adaptive-icon masking; a solid badge does not).

## 6. Icon Rules

- **Safe zone:** Android adaptive icons only guarantee the inner ~67% of the canvas survives regardless of
  launcher mask shape (circle, squircle, rounded-square all vary by device/launcher). The badge's full
  extent — center position *plus* its own radius — must stay inside that inner safe circle, not just inside
  the square canvas.
- **Source format:** deliver icons as a flat, full-bleed square (1024×1024), uncropped, unmasked. Apple and
  Android both apply their own masking on top of a square source — never submit a pre-rounded or
  pre-circled icon.
- **No gradients, bevels, or drop shadows on the icon itself** — flat color only. This keeps the icon
  legible at small sizes and consistent across platforms that render/compress differently.

## 7. Light and Dark Versions

- **App icons themselves stay a single fixed asset** — standard platform convention; iOS 18+ does support
  an optional separate "dark/tinted" icon variant, but producing that is a future-phase decision, not
  covered by this guide.
- **Wordmark has explicit light and dark versions** (§2), since it appears in more varied contexts —
  website headers, documents, potentially dark-themed UI surfaces — where a single fixed version would
  break contrast in at least one context.

## 8. Minimum Sizes & Safe Margins

Validated directly, not just specified — see `branding/previews/minimum-size-stress-test.png`, which
renders all three icons at 16, 24, 29, 40, 48, and 64px (the real range from a browser favicon up to a
standard Android launcher icon).

- **Below ~24px, the badge letter stops being legible** — expected and acceptable; at that size even
  platform-native icons rely on silhouette/color alone, not fine detail.
- **At 29px (iOS's smallest reference size) and above, the badge is legible** as a distinct colored mark,
  though the letter itself is only clearly readable from 40px up.
- **Recommendation:** treat 40px as the practical minimum for "the badge communicates which app this is";
  below that, differentiation falls back to the master color + app name label, which is always present
  alongside the icon on every real platform surface (home screen, store listing).

## 9. Do's and Don'ts

**Do:**
- Keep the master color (`#710f44`) identical across every current and future Wafina app.
- Keep the dot shape and badge position identical across every app — consistency is what makes this read
  as one product, not the color alone.
- Use the app's official name (e.g. "Wafina Doador") alongside the icon wherever space allows — the name is
  doing real differentiation work, not just the badge.

**Don't:**
- Don't introduce a fourth "master" color for a future app — add a new badge color instead.
- Don't use a stroke/ring for differentiation — tested and rejected (§5, §9 rationale above).
- Don't place any identifying mark outside the adaptive-icon safe zone (§6).
- Don't add gradients/shadows/bevels to the icon — flat only.
- Don't stretch, skew, or recolor the master mark outside this palette.

---

## 10. Realistic Previews — Validation Round

Generated to directly test the stated objective (readability at small sizes) rather than assert it. These
are schematic mockups built from real masking math and real render sizes — not photorealistic device
renders (that would need an image-generation tool this environment doesn't have), but the mask shapes,
proportions, and pixel sizes are accurate to how each platform actually renders icons.

| File | What it shows |
|---|---|
| `previews/adaptive-icon-masking-validation.png` | All three icons under circle, squircle, and rounded-square masks side by side — the direct test of the §6 safe-zone claim |
| `previews/android-launcher-mockup.png` | Circle-masked icons in an Android-style launcher row, realistic size, with name labels |
| `previews/ios-home-screen-mockup.png` | Squircle-masked icons in an iOS-style home screen row, realistic size, with name labels |
| `previews/google-play-listing-mockup.png` | Circle-masked icon as it appears in a Play Store listing header, with app name/rating line |
| `previews/apple-app-store-listing-mockup.png` | Squircle-masked icon as it appears in an App Store listing header |
| `previews/minimum-size-stress-test.png` | All three icons at 16/24/29/40/48/64px — the actual smallest real-world sizes |

**Result: the badge system holds up under every mask shape and survives down to a real, usable minimum
size (~40px) before falling back to color+name differentiation, which is expected and fine.** No mask
shape clips the badge, confirming the safe-zone math in §6 rather than just asserting it.
