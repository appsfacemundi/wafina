# Wafina — Branding Direction Proposal

**Status:** Decision pending. Nothing here is wired into `app.json`, any app config, splash screens, or
build assets. This is a comparison to inform your decision, not a default.

Two concrete icon concepts were produced (sent as PNGs) so this isn't an abstract discussion:

- **Option 1 — Unified:** one master mark (pink `#ad1a67` background, white dot — the existing shared
  accent) used identically for Donor. Institution and Admin get the *same* master mark with a thin colored
  ring added around the dot (green for Institution, blue for Admin) — a small accent, not a color swap.
- **Option 2 — Separate:** three fully distinct solid-color backgrounds (pink / green / blue), same dot,
  no shared base color at all — sent in the previous round.

---

## Comparison

| | Option 1 — Unified | Option 2 — Separate |
|---|---|---|
| **UX — recognizability** | Consistent "family" feel; risk that a thin ring is too subtle at small icon sizes (home screen, notification tray, ~48–72px) and after platform icon-masking (Android adaptive icons crop aggressively) | Maximum at-a-glance distinction; safest against accidental mis-taps if the same person has multiple Wafina apps installed (plausible — an institution's volunteer coordinator may also personally donate) |
| **UX — instructions/support** | Harder to describe over text/WhatsApp support ("the one with the thin blue ring") | Easy to describe ("the green Wafina icon") — matters for less tech-savvy institution staff (churches, community centers, per the product's own target users) |
| **Branding — platform trust** | Strongest signal of "one serious, coherent platform" — matters for institutions who need confidence in who's handling donations | Real risk of reading as unrelated apps *if* nothing else reinforces the connection — mitigated somewhat since app names still say "Wafina Doador" / "Wafina Instituição" / "Wafina Admin" |
| **Branding — precedent** | Common for suites that want to be seen as one product (Google Workspace-style: shared shape/style, accent-only variation) | Also a legitimate, common pattern for apps serving genuinely different roles (Uber / Uber Driver / Uber Eats use quite distinct identities despite one company) |
| **Branding — future flexibility** | Constrains each app's visual "personality" going forward; a rebrand only touches one master + accent rule | Each app can evolve its own tone independently over time |
| **Long-term product** | Cheaper to maintain (one master + accent rule); sets up cleanly for cross-promoting apps to each other's users later | Scales cleanly if more apps/roles are added — each just gets a color, no need to keep inventing subtle variations; easier to spin off one app's identity independently if that's ever needed |

---

## My read

You already leaned toward Option 1 in how you framed the ask — "one master logo," "do not create the
feeling these are three unrelated applications." Given the actual user base (institution staff are often
less technical — churches, orphanages, community centers, per the product spec), a strong, trustworthy
single "Wafina" identity likely matters more than fast color differentiation. App *names* still differ and
are what most users actually read to tell apps apart on a home screen, which reduces the mis-tap risk
somewhat.

If you go with Option 1, the one concrete refinement I'd suggest before finalizing: the ring as sent may be
too thin to survive scaling down to real icon sizes and Android's adaptive-icon masking — worth testing on
an actual device (which is already part of your planned real-device phase) before treating the ring weight
as final, rather than guessing further from here without a device to check it on.

This is your call, not mine to make — both options are legitimate and used by real, serious products.

---

## Option 3 — Unified Plus (approved direction, refined)

You approved the unified direction but correctly rejected the thin ring — it's exactly the kind of detail
that looks fine at 1024px and vanishes at real launcher sizes or under Android's adaptive-icon masking.
Replaced with a solid badge chip instead of a stroke:

- **Identical master mark for all three apps**: same pink (`#ad1a67`) background, same white dot, same
  shape, same file structure — nothing about the dominant visual identity changes between apps.
- **One solid badge circle** in the bottom-right, containing a single bold letter (D / I / A), white on a
  filled color background — Donor uses `#241a20` (the design system's existing neutral text color, not a
  new accent — Donor reads as the "base/flagship" identity), Institution `#0f6e5c` (green), Admin `#2e6fa3`
  (blue).
- **Badge placement respects Android's adaptive-icon safe zone.** Android launchers mask adaptive icons to
  circle, squircle, or rounded-square shapes depending on the device, but only guarantee the inner ~67% of
  the canvas stays visible regardless of mask shape. The badge (including its own radius) is positioned
  fully inside that safe circle, not just inside the square canvas — a ring positioned near the edge, or a
  badge placed without doing this math, risks getting clipped on some real devices.
- **Typography**: badge letters use a bold sans-serif, matching the *weight* of the existing design
  system's `WorkSans-700` token conceptually — this environment can't rasterize the actual custom Wafina
  font files (no font-registration pipeline available here), so the final production version should
  substitute the real `WorkSans-700` file once produced by a proper design tool.
- **Proof, not just a claim**: rendered a 96px contact-sheet version (close to a real home-screen icon
  size) alongside the full 1024px mockups, specifically so legibility can be judged directly rather than
  taken on faith.

### Recommendation

**Option 3 (Unified Plus) is what I'd recommend for long-term branding.** It's the only one of the three
that satisfies every principle you stated simultaneously: one master logo, one shape, one typography
system, color used only where it earns its place (the badge, not the dominant field), and a differentiator
that's actually built to survive real-world icon rendering rather than one that looks fine only in a
mockup. Option 1's ring was closer in spirit but had a genuine, checkable technical weakness; Option 2
traded away the unified identity you explicitly wanted. Option 3 keeps Option 2's real-world legibility
(a solid, high-contrast shape reads at a glance, just like a solid color did) while keeping Option 1's
unified platform identity intact.

The one thing I can't fully close from here: exactly how crisp that badge renders after Android/iOS's own
icon-generation pipeline resizes and compresses it on a real device. The contact sheet is the closest proxy
available in this environment — a real on-device check during your planned testing phase is still the
final word, not a formality.

---

## Master color update — wine/burgundy reference

You supplied a reference image (a marketing-style graphic for "Wafina Doador") and asked for its darker
wine/burgundy tone to become the master brand color across the entire ecosystem, reusing an existing design
system token rather than inventing a new one if a close match already exists.

**Color decision: `bougainvillea700` (`#710f44`)** — the darkest step already defined in
`packages/ui`/`apps/*/src/theme/tokens.ts`'s existing palette, same family as the pink previously used as
master (`bougainvillea500`, `#ad1a67`), just a darker point on the same scale. This is a judgment call, not
a pixel-sampled match — I can't extract exact RGB values from an uploaded image in this environment, so
"close enough to reuse" is a visual assessment, not a measurement. Worth confirming side-by-side once you
see the regenerated mockups; if it's visibly off, the fallback is a genuinely new custom hex value rather
than forcing a mismatched existing token.

**Applied to:**
- All three Unified Plus icons — background changed from `#ad1a67` to `#710f44`. Badge colors (Donor's
  neutral dark, Institution's green, Admin's blue) are unchanged — those were never tied to the master
  color, only the dominant field was.
- The wordmark — the dot was previously a two-color gradient blending pink and green (`bougainvillea500` →
  `palm500`), representing "two colors, one platform." That gradient concept is now superseded: with a
  single master color as the explicit direction, the dot is simplified to solid `bougainvillea700`,
  consistent with "one master brand colour" rather than a blend.

**One design note worth flagging, not hiding:** the darker background reduces the contrast "pop" between
the field and the Institution badge specifically (`#710f44` wine vs. `#0f6e5c` green sit closer together in
lightness than the previous pink-vs-green pairing did). The white letter inside each badge still carries
the actual legibility, so this isn't a functional problem, but it's a real, visible shift from the previous
version — check the regenerated contact sheet with that specifically in mind, not just the full-size
mockups where the difference is less noticeable.

### Final recommendation

Reuse `bougainvillea700` as the master, applied identically everywhere (logo, wordmark, website, all three
apps), with Institution/Admin differentiation staying confined to the badge only — exactly as instructed.
This is a coherent, low-risk choice specifically because it's not a new invention: it's a color that
already exists in the design system today, so adopting it as master doesn't introduce any new token to
maintain, and it stays inside the same design language (`bougainvillea`/`palm`/`dusk` family) that the rest
of the product already uses. The only open item is your own visual confirmation that `#710f44` genuinely
matches your reference closely enough — that's a judgment only you can close, since I'm working from a
screenshot, not a color-accurate source file.
