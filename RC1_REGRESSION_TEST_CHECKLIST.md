# RC1 Regression Test Checklist

Living QA reference, maintained by whoever is acting as QA Lead for release work. Updated after each
change that touches donation creation, corporate attribution, or claim/delivery flows. See
`PROJECT_QA_MEMORY.md` for full test evidence/commit history behind every checked item below.

**Last updated:** 2026-08-02, after the Individual vs. Corporate donation feature (`2c1dce5`) and its
post-deploy regression pass (`f9251d1`).

---

## 1. Critical path — Individual vs. Corporate donations (new, this cycle)

Verified against live production via automated API-level checks (23/23 passed, see
`PROJECT_QA_MEMORY.md`). Items marked ⬜ below are the same feature but a layer this pass **did not**
cover — flagging honestly rather than implying full coverage.

- [x] Donor without a linked company never sees the "Doar como" choice (personal-only, unchanged)
- [x] Donor with a linked company can submit an **Individual** donation → `Corporate_Account_ID` null
- [x] Donor with a linked company can submit a **Corporate** donation → `Corporate_Account_ID` = their company
- [x] "Minhas Doações" shows the donor's own donations only, both kinds, never a teammate's
- [x] Institution sees, claims, and runs **both** donation types through the full
      claim → schedule → collect → deliver lifecycle with no divergence in behavior
- [x] Admin's company `Donation_Count` counts only Corporate-flagged donations
- [x] Invitation code redemption still links a donor to a company correctly
- [x] Impact Stories (create → Admin approve → donor visibility) unaffected
- [ ] **Manual UI click-through, Donor Web** — confirm the "Doar como" select renders correctly and
      the 👤/🏢 labels display as expected in the browser (this cycle only verified the underlying
      data was correct via API; the rendered UI itself was not clicked through after deploy)
- [ ] **Manual UI check, mobile (iOS + Android)** — `DonateScreen.tsx` and `MyDonationsScreen.tsx`
      were edited and typecheck clean, but **never run in a simulator/device this cycle**. No Expo/
      simulator session has exercised the new Select or the attribution label on mobile yet.
- [ ] Dark mode / mobile-width rendering of the new "Doar como" select and attribution labels

## 2. Existing core functionality to re-test (touched indirectly by this change)

These weren't changed on purpose, but sit close enough to the edit that they deserve a deliberate
re-check before the next milestone, not just an assumption they still work:

- [x] Donation creation (photo upload, GPS/address fallback, item type selector) — re-verified as
      part of this cycle's regression pass, both donation types
- [x] Institution "Available Donations" country-scoped empty state (from the earlier
      donation-visibility investigation) — message still correct after this change
- [ ] **Corporate Accounts / Companies Admin page** — full manual click-through (create company,
      generate/copy/deactivate code) hasn't been repeated since the copy-button addition landed;
      only re-verified at the API level this cycle
- [ ] **Settings → "Conta Corporativa" join flow** on Donor Web/mobile — not re-clicked through this
      cycle, only exercised via direct API calls (`/donor/corporate/join`)
- [ ] Reports page (Admin) — donation/company figures should be spot-checked to confirm they read
      the same `Corporate_Account_ID`-based counts correctly, not a separate stale code path

## 3. Not yet started (tracked elsewhere, not blocking this checklist)

- Android/iOS release builds (Phase 4) — once generated, the mobile UI items in §1 become testable
  on real builds instead of simulator/dev-client only
- Content Rating questionnaire, App Store Connect setup (Phase 3, unrelated to this feature)

---

**How to use this file:** before starting the next milestone, clear as many ⬜ items as practical.
Anything still unchecked when moving to Phase 4 (Release Builds) should be called out explicitly to
the stakeholder as a known gap, not silently carried forward.
