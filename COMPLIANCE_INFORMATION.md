# Compliance Information — Google Play Console & Apple App Store Connect

**Status:** Draft prepared 2026-08-02, for the stakeholder to enter into both consoles. This
environment has no console access (no credentials, and submitting store forms is a console-side
account action outside what a coding session should do on its own) — this file is reference content,
not a submission log. Cross-references `RC1_RELEASE_ROADMAP.md` Phase 3 and reuses the data-practice
facts already verified for `apps/web/src/app/privacy/page.tsx` and `.../terms/page.tsx`.

**How to use this file:** each section below is either a direct answer to paste into the console
questionnaire, or — where marked — an open question that needs your decision before an answer exists.
Every claim here was checked against the actual running code (see "Verified facts" at the end), not
assumed from the spec.

---

## 1. Google Play Console — App content declarations

Covers the "App content" section of Play Console, beyond what's already done (Store Listing copy
drafted; Privacy Policy/Data Safety published — see roadmap).

| Declaration | Answer | Basis |
|---|---|---|
| **Ads** | No ads | No ad SDK anywhere in `package.json` across any workspace |
| **News apps** | Not a news app | N/A to Wafina's purpose |
| **COVID-19 apps** | Not a COVID-19 app | N/A |
| **Government apps** | Not a government app | N/A |
| **Financial Features declaration** | No financial features | No payment/IAP SDK anywhere; Wafina moves donated goods, never money — confirmed no monetary donation flow exists in code or Terms |
| **Health Connect access** | No | No `expo-health`/Health Connect integration |
| **Target audience** | General audience, not designed for or directed at children | No age/birthdate field collected anywhere; no child-directed content or design |
| **Permissions declaration form** | Not required | `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` are foreground-only (confirmed: no `ACCESS_BACKGROUND_LOCATION`, no background location API usage) — outside Play's restricted-permissions list that requires the separate declaration form |
| **Data safety** | Already published | See `apps/web/src/app/privacy` — reuse that page's data-type table directly in the Data Safety form; no new analysis needed |
| **Content rating (IARC questionnaire)** | Recommended answers below | — |
| **App access** (reviewer login) | Open item — see below | — |

**Content rating (IARC) — recommended answers**, based on actual app content (donation photos,
institution profiles, Success Stories, in-app notifications):
- Violence, sexual content, profanity, controlled substances, gambling: **None** — confirmed no such
  content type exists anywhere in the product
- User-generated content: **Yes** (donation photos, institution logos, Success Story photos/text) —
  answer honestly; this is what it is
- Users can interact / share personal info: **Yes**, but no free-text user-to-user chat exists —
  notifications are system-triggered, not user-composed messages (confirmed: no messaging feature in
  the codebase). Answer the "user communication" sub-question as *no direct user-to-user messaging*.
- Expected outcome: lowest tier (Everyone / PEGI 3-equivalent) with a "Users Interact" / "Shares
  Location" content descriptor from the location and UGC answers above, not from any mature content.

**App access — open item:** Play's reviewers need a working login to test the app. Recommend creating
one **permanent** reviewer test account (not a disposable one deleted after use, since Play may re-review
on every update) — e.g. `wafina.playreview@<domain>` as a real `Donor` account with placeholder (not
real-person) profile data. This is a one-time setup decision for you, not a code change.

---

## 2. Apple App Store Connect — compliance

| Declaration | Answer | Basis |
|---|---|---|
| **Export compliance (encryption)** | Exempt — uses only standard HTTPS/TLS | All network calls go over HTTPS to Render/Firebase/Google APIs; the only `node:crypto` usage in `apps/api` is `randomUUID`/`randomBytes` for ID generation, not custom encryption. Qualifies for Apple's standard exemption (no annual self-classification report needed) |
| **Sign in with Apple (Guideline 4.8)** | **Not required** | Confirmed: no third-party social login exists anywhere (`GoogleAuthProvider`, Google/Facebook/Apple sign-in packages — none found). Auth is Firebase email/password only. The 4.8 requirement only triggers when a third-party login option is offered; since it isn't, this is a non-issue — worth stating plainly so it isn't mistakenly built as "required" |
| **Age rating questionnaire** | Same basis as Play's IARC answers above | Mirror the "None" answers for mature content, "Yes" for UGC, "no" for user-to-user messaging. Expected outcome: **4+** |
| **App Privacy ("nutrition label")** | Reuse Privacy Policy's data table | Contact Info (name, email, phone), Location (precise — pickup/institution address), Photos, User ID (Firebase UID) — none used for tracking/advertising (confirmed no analytics/ad SDK), none linked to a third-party data broker |
| **Content rights** | No third-party licensed content | All UI content is original; user-uploaded photos are the uploading user's own content, consistent with the Terms & Conditions' item-responsibility clause |

---

## 3. User-generated content moderation (Apple Guideline 1.2 / Play's UGC policy) — open item

Both stores require, for apps with user-generated content visible to others: content filtering, a way
for users to **report** objectionable content, and a way to **remove** content/**block** abusive users.

**What exists today:**
- Success Stories go through Admin **pre-publish moderation** (`Status: Pending` until an Admin calls
  `approveSuccessStory`/`rejectSuccessStory` in `apps/api/src/services/success-stories.ts`) — this
  satisfies the "content filtering" requirement for the one type of broadly-public UGC in the app.
- Admin can **suspend a user's account entirely** (Phase A's Users management) — a coarse form of
  "remove abusive users."

**What's genuinely missing:**
- No in-app "report" button anywhere (donation photos, institution profiles, or published Success
  Stories) for a user to flag something after it's visible.
- No way for Admin to un-publish/delete a Success Story once approved — only `approve`/`reject` exist,
  and `reject` only applies pre-publish (confirmed: no post-approval removal function in the service).

**This needs your decision, not a silent build** (Version 1 Feature Freeze): donation photos are seen
only by institutions in a transactional context (closer to a marketplace listing than open social UGC),
which is a defensible reduced-risk posture on its own. Success Stories are the one genuinely
public-facing UGC surface. Options, roughly in order of effort:
1. Ship as-is for RC1 — pre-publish moderation + account suspension is a real, defensible answer for a
   launch-scale NGO donation app, and many comparable apps ship with exactly this level of control.
2. Add a lightweight "report" flag on published Success Stories + a corresponding Admin unpublish
   action — small, contained addition if you want stronger footing before submitting to review.

---

## 4. Cross-reference: other Phase 3 items

- **In-app account deletion** — resolved 2026-08-02, see `RC1_RELEASE_ROADMAP.md` Phase 3. Donor
  accounts now have true self-service deletion (`DELETE /donor/account`); Institution accounts stay
  support-mediated via the `/delete-account` page, now linked from every app's Settings screen. Not
  duplicated here, just cross-referenced since it's compliance-adjacent (Play's Data Safety form).

---

## Verified facts this draft relies on

Checked directly against the code on 2026-08-02, not assumed:
- No ad SDK, no payment/IAP SDK, no analytics/tracking SDK in any `package.json`
- No third-party social sign-in (Google/Apple/Facebook) anywhere — Firebase email/password only
- No background location API usage or `ACCESS_BACKGROUND_LOCATION` permission
- No age/birthdate field collected at registration on any app
- Only `node:crypto` usage is `randomUUID`/`randomBytes` (ID generation) — no custom encryption
- No in-app messaging/chat between users
- No post-publish content report/removal mechanism for Success Stories

If any of these change (e.g. a future analytics SDK or social login is added), this file goes stale on
that point specifically and should be re-checked before submission.
