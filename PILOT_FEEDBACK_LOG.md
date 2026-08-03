# Pilot Feedback Log

## The 5-phase plan this belongs to

1. **Pilot Polish** (here) — real device testing, batched fixes.
2. **UX Review** — Claude reviews with a designer/engineer lens, still no new features.
3. **Launch Readiness** — Google/Apple reviewer-style audit, no blocking issues.
4. **Publishing** — final AABs, store assets, Play Console submission.
5. **Soft Launch** — 5–10 real people use it unguided; watch where they hesitate.

**Do not skip ahead.** Each phase starts only once the previous one is genuinely done.

## Testing mindset

Test like a first-time donor, first-time institution, or a volunteer who's never seen Wafina before, not
like a developer checking "does it work." Ask: Is it obvious? Is it fast? Would my mother understand this
without instructions?

**Don't only test the happy path.** Intentionally try to break it:
- Cancel an upload mid-way
- Turn Wi-Fi off / turn mobile data off
- Rotate the phone
- Press Back repeatedly
- Upload a very large photo, or several at once
- Leave the app mid-upload
- Receive a phone call during a process
- Kill the app and reopen it

These scenarios surface issues normal use won't.

## Evidence rule — mandatory

**Every issue must carry one of these tags. If it doesn't fit one, don't add it:**

- 📱 Observed on your real phone
- 👤 Reported by a real tester
- 📋 Required by Google Play or Apple
- 🐛 Functional bug

This keeps the list evidence-based, not opinion-based.

## Severity

🚫 **Blocker** — user cannot complete the donation flow (can't log in, can't upload a donation,
institution can't claim, crash, data loss). **Fixed immediately, not batched.**

🔴 **High** — feature works but creates real frustration (tabs too small, wrong sort order, missing
filter, confusing navigation). Fix before launch.

🟡 **Medium** — improves quality, doesn't stop users (spacing, typography, animations). Fix if time
allows.

🟢 **Low** — nice to have (wording, tiny visual polish, micro-animations). Can wait until RC1.1.

## Batching + validation workflow

1. Batch of **10–15 issues** (🚫 Blockers get fixed the moment they're found, don't wait for a batch).
2. Claude fixes the batch.
3. One APK build.
4. **You test a full session before creating the next batch** — confirm the fixes actually improved
   things, not just that they compiled. Only then start Batch 2.

## Rule for Claude

**Do not propose improvements unless they carry one of the four evidence tags above, or are necessary
for store compliance.** No opinion-based polish, no scope creep. If a fix would require touching
something not on the list, ask before expanding scope.

---

## Batch 1 — Open

| Priority | Screen | Issue | Evidence | Suggested Fix | Status |
|---|---|---|---|---|---|
| 🔴 High | Shared `Button` component (Donor + Institution) | No `accessibilityRole`/`accessibilityLabel` anywhere; touch target ~43px, just under Apple's 44pt minimum | 📋 Store compliance | Add accessibility props at the component level (highest leverage — used almost everywhere); bump `minHeight` to 48 | Open |

*(add rows as you find them — Priority/Screen/Issue/Evidence are required; Suggested Fix is optional)*

---

## Resolved

*(moved here once fixed and verified on-device, with the commit hash)*
