# Pilot Feedback Log

## RC1 Exit Criteria

RC1 is only declared **"Launch Ready"** when every one of these is checked:

- [ ] No Blockers
- [ ] All High issues closed and verified
- [ ] Medium issues accepted or fixed
- [ ] Low issues documented for RC1.1 if deferred
- [ ] Google Play compliance complete
- [ ] Apple compliance complete
- [ ] APK/AAB verified
- [ ] Real-device testing completed
- [ ] Pilot Feedback Log fully reviewed
- [ ] Launch Readiness Audit passed

**At that point:** stop development entirely, tag the release in Git, archive this log, and move into
publishing and post-launch support — not continued tweaking.

---

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

**Don't only test the happy path.** Intentionally try to break it: cancel an upload mid-way, turn Wi-Fi/
mobile data off, rotate the phone, press Back repeatedly, upload a very large photo or several at once,
leave the app mid-upload, receive a call during a process, kill the app and reopen it.

## Regression Check — every time you install a new APK

Spend 5 minutes on these **before** looking at new fixes. If any of these break, stop and fix the
regression first — don't keep testing new items on top of a broken core flow.

**Donor:** Sign in · Create donation · Upload photos · View donation · Notifications · Profile

**Donor — not currently implemented, don't test as a "regression":** Edit donation, Delete donation.
Confirmed via code audit this session — no UI exposes editing (backend supports it while Pending, but no
screen calls it) and no delete endpoint exists anywhere in the backend. Not a bug, just not built.

**Institution:** Sign in · View available donations · Claim donation · Schedule pickup · Confirm collection
· Confirm delivery · Impact story

## Evidence rule — mandatory

**Every issue must carry one of these tags. If it doesn't fit one, don't add it:**

- 📱 Observed on your real phone
- 👤 Reported by a real tester
- 📋 Required by Google Play or Apple
- 🐛 Functional bug

## Severity

🚫 **Blocker** — user cannot complete the donation flow (can't log in, can't upload, institution can't
claim, crash, data loss). **Fixed immediately, not batched.**

🔴 **High** — feature works but creates real frustration. Fix before launch.

🟡 **Medium** — improves quality, doesn't stop users. Fix if time allows.

🟢 **Low** — nice to have. Can wait until RC1.1.

## Batching + validation workflow

1. Batch of **10–15 issues** (Blockers fixed immediately, not batched).
2. Claude fixes the batch.
3. One APK build.
4. **You run the Regression Check, then test a full session** before creating the next batch — confirm
   fixes actually helped, and nothing else broke. Only then start Batch 2.

## Rule for Claude

**Do not propose improvements unless they carry one of the four evidence tags, or are necessary for store
compliance.** No opinion-based polish, no scope creep. If a fix needs touching something not on the list,
ask before expanding scope.

---

## Batch 1 — Open

| Priority | Evidence | Screen | Issue | Suggested Fix | Owner | Status | Verified |
|---|---|---|---|---|---|---|---|
| 🔴 High | 📋 Store compliance | Shared `Button` component (Donor + Institution) | No `accessibilityRole`/`accessibilityLabel` anywhere; touch target ~43px, just under Apple's 44pt minimum | Add accessibility props at the component level; bump `minHeight` to 48 | Claude | Open | ☐ Not tested |

*(Priority/Evidence/Screen/Issue are required; Suggested Fix/Owner optional until triaged)*

**Owner:** Claude (code fix) · You (a decision/content/account-side thing) · Both (needs your input, then
a code fix).

**Verified:** ☐ Not tested → 🟡 Fixed, waiting for device verification → ✅ Verified on real device. An
issue is only closed once it's ✅, not just because the code changed.

---

## Resolved

*(moved here once ✅ Verified on real device, with the commit hash)*
