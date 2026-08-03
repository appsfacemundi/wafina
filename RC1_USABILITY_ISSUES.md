# RC1 Usability Issues

**Workflow:** test on your phone, add every issue you notice below as you find it — no need to sort,
group, or prioritize while adding. Don't worry about wording it perfectly; a rough note is enough for
each. Once there are ~10–20 items, hand the whole list back and it gets fixed as one batch, then one
rebuild — not a build per item.

**Scope reminder (per RC1 Feature Freeze):** this list is for usability/polish — spacing, touch targets,
typography, hierarchy, accessibility, navigation feel. Not for new features (those go to
`VERSION_2_ROADMAP.md`) and not for functional bugs (those get fixed immediately when found, not queued).

---

## Open Items

1. **[Donor + Institution] Shared `Button` component has zero accessibility support.** No
   `accessibilityRole`/`accessibilityLabel` anywhere, and its touch target (~43px tall) sits just under
   Apple's 44pt minimum. This is the app's primary interactive control, used almost everywhere — fixing
   it once has the highest leverage of anything on this list. Confirmed via code inspection during the
   RC1 audit, not from device testing.
2. *(add yours here as you test)*

---

## Resolved

*(moved here once fixed, with the commit hash)*
