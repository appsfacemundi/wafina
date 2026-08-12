# Phase 2, Item 7 — Store Screenshot Strategy

**Date:** 2026-08-12. This is the strategy/sequence half of item 7 — what to shoot, in what order, with
what caption. It does **not** include the actual screenshots: capturing real screens requires a signed-in
device session, which this session doesn't do on your behalf (the same rule already applied throughout
Phase 2). See "What happens after you capture" below for how the two halves connect.

Every screen referenced below is a real, currently-shipping screen — checked against the actual source this
session, not copied from a generic template. No screen listed here is aspirational or planned-but-unbuilt.

---

## Technical specs (verified today, not from memory)

**Apple App Store:**
- Only the largest size per device family is required — Apple auto-scales down to populate older devices.
- iPhone: 6.9" class, portrait, **1320×2868px** (the current largest iPhone screenshot class).
- Up to **10 screenshots per localization**, minimum 1.
- **Verify directly in App Store Connect before uploading** — third-party guides (not Apple's own docs)
  were used to confirm these numbers, and Apple has changed exact pixel dimensions before when new device
  classes ship.

**Google Play:**
- Phone screenshots: **1080×1920px recommended** (portrait), min 320px/max 3840px per side, aspect ratio
  between 16:9 and 9:16.
- Minimum **2 screenshots required to publish**, maximum 8 per device type.
- JPEG or 24-bit PNG, **no alpha channel**, max 8MB each.
- **Verify directly in Play Console before uploading**, same caveat as above.

---

## Wafina Doador — 5-beat sequence (revised 2026-08-12, per approved narrative)

| # | Beat | Screen (real, current) | Headline (PT-PT) | Subcopy |
|---|---|---|---|---|
| 1 | Descubra o que pode doar | Home (DOAR + RECEBER entry cards) | Descubra o que pode doar | Roupa, alimentos, material escolar e outros bens — tudo num só lugar. |
| 2 | Publique a sua doação | DonateScreen (photo, item type, quantity, location) | Publique a sua doação | Fotografe, descreva e indique o local de recolha em poucos passos. |
| 3 | Acompanhe o estado da doação | MyDonationsScreen (status tracker) | Acompanhe o estado da doação | Do registo à entrega, saiba sempre em que fase está. |
| 4 | Veja quando a instituição/beneficiário recebe | MyDonationsScreen, "Entregue" state — or Impact/Success Story tied to that donation | Veja quando a sua doação chega | Receba notificações a cada etapa, até à confirmação de entrega. |
| 5 | Faça parte da transformação | Impact / Success Stories feed | Faça parte da transformação | Veja histórias reais de quem recebeu o que doou. |

**Icon-identity reinforcement:** every frame uses the app's pink `#B50C5E` as the dominant accent (status
bar area / bottom device chrome in the framed export), so the sequence reads as "the pink app" at a glance,
consistent with the launcher icon.

**RECEBER note:** the earlier 7-shot draft gave RECEBER its own two beats; this 5-beat version folds it
implicitly into beat 1 (the Home screen shown there already surfaces both DOAR and RECEBER entry points).
If you want RECEBER to get its own dedicated beat instead of sharing space in beat 1, say so and I'll
extend back to 6-7 shots — Apple/Play both allow up to 8-10, so there's room.

---

## Wafina Instituição — 5-beat sequence (revised 2026-08-12, per approved narrative)

| # | Beat | Screen (real, current) | Headline (PT-PT) | Subcopy |
|---|---|---|---|---|
| 1 | Encontre doações disponíveis | AvailableDonationsScreen | Encontre doações disponíveis | Veja o que está disponível na sua área, em tempo real. |
| 2 | Solicite/receba uma doação | AvailableDonationsScreen → claim action / ClaimedByMeScreen right after claiming | Reclame o que pode receber | Um toque para reclamar uma doação para a sua instituição. |
| 3 | Acompanhe o processo | ClaimedByMeScreen (schedule → collect states) | Acompanhe o processo | Agende a recolha e siga cada etapa até à entrega. |
| 4 | Confirme a entrega | ClaimedByMeScreen delivery confirmation + thank-you note | Confirme a entrega | Registe a receção e envie uma palavra de agradecimento a quem doou. |
| 5 | Gere impacto na comunidade | Success Story creation (photo + text) | Gere impacto na comunidade | Publique fotos e histórias para mostrar o efeito real das doações. |

**Icon-identity reinforcement:** every frame uses the app's blue `#0057D9` as the dominant accent, matching
the launcher icon, so the two apps' screenshot sets are visually distinguishable in a store search result
grid even before either app name is read.

**Animal Shelter note:** the earlier 7-shot draft gave Animal Shelter registration its own beat; this
5-beat version omits it to match your exact requested narrative. If Animal Shelter support should be
visible in the screenshot set (it's a real, shipped feature), it fits naturally as an optional 6th beat —
your call.

---

## Capture instructions (for you, at a signed-in device)

To get clean, representative screens:
1. Use a disposable test account per app (same pattern used throughout this project) with realistic-looking
   but not real data — a real donation photo, a plausible item description, a real (test) institution name.
   Empty states or lorem-ipsum-looking content reads poorly in a store listing.
2. Hide the OS status bar clutter where possible, or accept it — Apple/Play both allow status bar visible,
   it just shouldn't show a low battery icon or a distracting notification.
3. Capture at the device's native resolution — don't screenshot a scaled-down simulator window.
4. One screenshot per row above, matching the screen named — send them over in order and I'll match them up.

## What happens after you capture

Once you have the 7 raw screenshots per app, I'll add consistent framing (device bezel or plain background,
your call), the headline/subcopy pairs above (or edits to them), and export at the exact pixel dimensions
both stores require — no further device access needed for that part, it's pure image composition from
files you provide.

---

## Status

🔴 Capture — blocked on you, per the above.
🟡 Sequence/copy — drafted here, ready for your edits before we lock it in.

Not proceeding to actual asset production until you've either approved this sequence/copy or sent revisions.
