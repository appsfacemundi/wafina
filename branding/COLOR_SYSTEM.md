# Wafina — App Color Identity (Draft, for review)

**Status:** Proposal only. Not wired into `app.json`, not used in any build. Nothing here has shipped —
review it, and if you want it applied, say so and I'll wire the icon files into each app's config as a
separate, explicit step.

## Why these colors

`apps/mobile-donor/src/theme/tokens.ts` and `apps/mobile-institution/src/theme/tokens.ts` are currently
**byte-for-byte identical** — both apps use the same pink/magenta (`bougainvillea`, `#ad1a67`) as their
only accent color. There is no visual differentiation between the two apps today. Nothing here invents a
new palette — every color below is already a named, defined token in the existing shared design system
(`packages/ui`, `apps/web/src/app/globals.css`), just reassigned to give each app its own identity instead
of leaving two consumer-facing apps looking identical.

| App | Color | Hex | Source |
|---|---|---|---|
| Donor | Bougainvillea (pink/magenta) | `#ad1a67` | Already the shared accent — kept as-is for Donor since it's the more consumer-facing, emotionally warm app |
| Institution | Palm (green) | `#0f6e5c` | Already exists as the system's "secondary" color today, underused — promoted to Institution's primary identity |
| Admin | Info blue | `#2e6fa3` | Already exists as the system's semantic "info" color — reused as Admin's identity since it's a conventional, professional dashboard color and clearly distinct from both consumer apps |

This also mirrors the existing web brand mark (`apps/web/src/app/globals.css` `.app-mark-dot`), which
already blends bougainvillea and palm in a single gradient — meaning Donor and Institution's colors were
already implicitly "sibling" colors in the one brand asset that exists today. This proposal just separates
them out per app rather than leaving them merged.

## Icon concept

Deliberately minimal: the existing web wordmark is text + a small solid-color dot
(`.app-mark` / `.app-mark-dot`). Rather than inventing new iconography, each app icon is that same dot
motif, isolated and enlarged as a standalone glyph — a solid color square (full-bleed, no pre-rounded
corners, since both Apple and Android apply their own icon masking to a flat square source) with a single
centered white circle.

Files:
- `branding/icons/donor-icon.png` / `.svg`
- `branding/icons/institution-icon.png` / `.svg`
- `branding/icons/admin-icon.png` / `.svg`
- `branding/wordmark/wafina-mark-combined.png` / `.svg` — the existing combined web mark, formalized as a
  standalone asset (previously only existed as inline CSS, not as an exportable file)

All PNGs are 1024×1024 (icons) — the resolution Expo/Play Store/App Store expect as the single master
source, from which each platform generates its own smaller sizes.

## What this is NOT

- Not a splash screen (needs its own composition, not just the icon centered).
- Not Play Store / App Store screenshots (those need an actual running app to capture).
- Not a feature graphic or social media kit.
- Not a final decision — this is a first-pass direction using only what already exists in the codebase.
  If you want a genuinely designed identity (illustration, custom typography treatment, icon-within-shape
  refinement), that's exactly the "dedicated design session with an image-generation model or a designer"
  you flagged earlier — this deliverable is scoped to what's honestly producible without one.
