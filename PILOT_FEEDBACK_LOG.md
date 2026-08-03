# Pilot Feedback Log

Part of the 4-phase RC1 plan: **Phase 1 (Pilot Polish)** — use the app naturally on a real device for
15–30 minutes, log everything that feels awkward as you go, don't stop to rebuild after each one. Once
there are ~15–20 items, hand the whole list back for one batch fix + one rebuild.

**Do not move to Phase 2 (UX Review) until this phase's batch is fixed and verified on-device.**
Phase 3 (Launch Readiness audit) and Phase 4 (Publishing) come after that, in order.

---

| Priority | Screen | Issue | Suggested Fix | Status |
|---|---|---|---|---|
| High | Shared `Button` component (Donor + Institution) | No `accessibilityRole`/`accessibilityLabel` anywhere; touch target ~43px, just under Apple's 44pt minimum | Add accessibility props at the component level (highest leverage — used almost everywhere); bump `minHeight` to 48 | Open |

*(add rows as you find them during testing — Priority/Screen/Issue are the minimum; Suggested Fix is
optional, leave blank if you're not sure what the fix should be)*

---

## Resolved

*(moved here once fixed and verified on-device, with the commit hash)*
