# Pilot Feedback Log

## The 5-phase plan this belongs to

1. **Pilot Polish** (here) — real device testing, batched fixes.
2. **UX Review** — Claude reviews with a designer/engineer lens, still no new features.
3. **Launch Readiness** — Google/Apple reviewer-style audit, no blocking issues.
4. **Publishing** — final AABs, store assets, Play Console submission.
5. **Soft Launch** — 5–10 real people use it unguided; watch where they hesitate.

**Do not skip ahead.** Each phase starts only once the previous one is genuinely done, not just "good enough."

## Testing mindset for this phase

Don't test like a developer checking "does it work." Test like a first-time donor, a first-time
institution, or a volunteer who's never seen Wafina before. Ask:
- Is it obvious?
- Is it fast?
- Would my mother understand this without instructions?

## Severity guide

🔴 **High** — buttons hard to tap, too many taps to complete a task, confusing navigation, slow/confusing
loading, wrong information order (e.g. oldest-first instead of newest-first), missing filters, anything
that makes you stop and think.

🟡 **Medium** — colors, fonts, alignment, card sizes, icons, padding, empty states.

🟢 **Low** — wording improvements, animation polish, cosmetic adjustments.

## Batching

Work in batches of **10–15 issues**, not one giant list: fix → build one APK → test again → next batch.
Smaller batches converge faster and avoid fixes that interact with each other in a big pile.

## Rule for Claude

**Do not propose improvements unless they're based on an issue actually observed during real-device
testing, or are necessary for store compliance.** No opinion-based polish, no "while I'm in here" scope
creep. If a listed fix would need touching something not on this list, ask before expanding scope rather
than doing it silently.

---

## Batch 1 — Open

| Priority | Screen | Issue | Suggested Fix | Status |
|---|---|---|---|---|
| 🔴 High | Shared `Button` component (Donor + Institution) | No `accessibilityRole`/`accessibilityLabel` anywhere; touch target ~43px, just under Apple's 44pt minimum | Add accessibility props at the component level (highest leverage — used almost everywhere); bump `minHeight` to 48 | Open |

*(add rows as you find them — Priority/Screen/Issue are the minimum; Suggested Fix is optional)*

---

## Resolved

*(moved here once fixed and verified on-device, with the commit hash)*
