# V2 Implementation Plan — Multiple Photos & GPS-Based Distance

**Status: AUDIT + PLAN ONLY — not implemented, not committed.** Written 2026-08-13 per explicit
instruction to inspect the architecture, produce a complete plan, and stop for approval before
touching any code. Nothing in this document has been built yet.

---

## 0. How this document is organized

Two independent features, each covering: current architecture findings → recommended data model →
API changes → mobile UI changes → storage/calculation approach → migration/backward-compatibility →
testing strategy → files to be modified. A shared risks/open-questions section closes it out —
**read that section before approving**, especially §2.1, which found a real product-design gap in
the GPS-distance request as written.

---

## 1. Feature: Multiple Photos Per Donation

### 1.1 Current architecture findings

- **Schema**: `Donation.Photo` (`packages/shared/src/types/donation.ts`) is a single `string` — one
  Google Drive URL. Same single-file pattern everywhere: Institution `Logo`, Success Story `Image`,
  Receiver `Thank_You_Photo`.
- **Storage**: `apps/api/src/config/drive.ts`'s `uploadPhoto(buffer, filename, mimeType)` uploads one
  buffer to a Google Drive Shared Drive, makes it public-read, returns one
  `drive.google.com/thumbnail?id=...` URL. `apps/api/src/config/photo-storage.ts` wraps this as a
  storage-agnostic `toProxiedUrl()`/`getPhotoStream()` pair — the app never talks to Drive directly,
  only ever sees `/photos/:id`. **This abstraction is exactly what makes multi-photo storage low-risk**:
  calling `uploadPhoto()` N times and storing N URLs requires zero changes to the storage layer itself.
- **Upload route**: `POST /donations` (`apps/api/src/routes/donations.ts:57-99`) uses
  `multer.memoryStorage()` with `upload.single('photo')` and an 8MB per-file limit
  (`upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })`,
  lines 45-51). Exactly one file, one form field.
- **Mobile capture**: `DonateScreen.tsx` uses `expo-image-picker` (`~57.0.7`) with
  `ImagePicker.launchCameraAsync`/`launchImageLibraryAsync({ quality: 0.8 })` — one asset picked at a
  time, held in a single `photo` state, sent via `expo-file-system`'s `uploadAsync` (chosen specifically
  because RN's own `FormData`/`Blob` multipart broke on Android — see the comment in `lib/api.ts:57-66`).
  **No resize step exists today** — `quality: 0.8` only controls JPEG re-encoding quality, not pixel
  dimensions. `expo-image-manipulator` is not currently a dependency of any app.
- **Display**: every card that shows `item.Photo` (`MyDonationsScreen`, `AvailableDonationsScreen`,
  `ReceberScreen`, Admin's donation views) renders a single `<Image>`.
- **Sheets storage precedent for arrays in one cell**: `Institution.Locked_Fields: string[]` and
  `Institution.Review_History: InstitutionReviewEvent[]` are already stored as JSON-stringified arrays
  in a single Google Sheets cell (parsed/serialized in `institutions.ts` via helpers like
  `parseReviewHistory`/`appendReviewEvent`). **This is the existing, proven pattern to reuse** — no new
  storage mechanism needs inventing.

### 1.2 Recommended data model

Add `Donation.Photos: string[]` (JSON-array-in-cell, same pattern as `Review_History`), keep
`Donation.Photo: string` as a **derived, read-only convenience field** = `Photos[0]` (the cover photo),
computed in `rowToDonation` rather than stored twice. This means:

- Every existing call site that reads `donation.Photo` (there are many, across 3 apps + Admin +
  emails) keeps working with zero changes — it just reads the first array element under the hood.
- New code (galleries) reads `donation.Photos`.
- New Sheets column: `Photos` (JSON array string, e.g. `["url1","url2",...]`). Old rows have this
  column blank.

**Why not just make `Photo` itself an array or rename it?** Renaming/retyping a field read in dozens
of places (every screen, every email template, Admin views, CSV exports) is a much larger, riskier
diff for no functional benefit over "derive the old field from the new one." Additive-only changes are
the safer path per the backward-compatibility constraint.

### 1.3 API changes

- `POST /donations` (create): change `upload.single('photo')` → `upload.array('photos', 10)`.
  `req.files` (plural) replaces `req.file`. Loop over files, call `uploadPhoto()` per file (sequential
  or `Promise.all`, capped at 10 so concurrency is bounded), collect URLs into `Photos`.
  - **Backward-compat on the wire**: keep accepting a single `photo` field too (older/cached clients,
    or a future web Donor client) — if `req.files` is empty but a legacy single-file `photo` field
    exists, treat it as a 1-photo array. Low cost, meaningfully de-risks the mobile rollout (see §3.3).
- `PATCH /donations/:id` (edit — the route I just built for the rejection-loop fix): same
  `upload.array('photos', 10)` swap. Needs new logic: does a photo-edit **replace** the whole set or
  **append**? Recommend **replace-the-whole-set**, matching how the mobile UI will work (donor sees
  and manages the full set client-side, submits the final array) — simpler mental model than a
  separate add/remove-single-photo API.
- `createDonation`/`editDonation` (`services/donations.ts`): `Photo: string` param becomes
  `Photos: string[]`. `assertValidDonationFields` gets a new check: 1–10 items, first item required.
- `Donation` type: add `Photos: string[]`. `InstitutionDonationView`/`AdminDonationView` inherit it
  automatically (they extend `Donation`).
- `rowToDonation`: parse `Photos` JSON; if blank/missing, fall back to `[row.Photo].filter(Boolean)`
  wrapped through `toProxiedUrl` per element — this is the one function that makes old rows transparently
  look like 1-photo arrays to every caller.
- Multer limits: per-file stays 8MB; add an explicit total-request cap (e.g. `limits: { fileSize: 8MB,
  files: 10 }` — multer supports a `files` count limit natively) so a malicious/broken client can't send
  an unbounded number of files before the array-length check even runs.

### 1.4 Mobile UI changes (Donor app — the only app that captures photos for a donation)

`DonateScreen.tsx`:
- `photo: PhotoValue | null` → `photos: PhotoValue[]` (max 10), reusing the `PhotoValue` type I
  already introduced for the rejection-loop edit-mode work.
- Photo section becomes a horizontal scrollable row of thumbnails (first = cover, visually marked,
  e.g. a small "Capa" badge) + an "add more" tile (disabled/hidden at 10).
- Tap a thumbnail → preview (full-screen or larger modal) with a remove (X) button.
- **Reordering**: drag-to-reorder is the "correct" UX but is a real implementation cost (needs a
  drag-and-drop list library — none currently in this project's dependencies). Recommend a simpler
  V2-scoped alternative: long-press or a small "Tornar capa" (make cover) button on each non-first
  thumbnail that swaps it to index 0, plus per-photo remove. Delivers the actual requirement ("choose
  which is the cover, remove ones you don't want") without a new drag-library dependency. Flagging
  this substitution explicitly for your sign-off rather than silently picking it.
- Submit validation: at least 1 photo (same as today), max 10 (client-side guard mirroring the
  server's).

`MyDonationsScreen.tsx` / `AvailableDonationsScreen.tsx` (mobile-institution) / `ReceberScreen.tsx`:
- Card's single `<Image source={{uri: item.Photo}}>` → cover photo by default, same as today
  (`item.Photos[0]` via the derived `Photo` field — **no visual change to the card/list views**).
- New: tapping the photo opens a full gallery viewer (swipeable, shows all `item.Photos`, with a
  page indicator "3/8"). This is the only genuinely new screen/interaction needed on the viewing side.

Admin web (`apps/admin/src/app/donations/page.tsx`): same gallery-viewer treatment for the donation
detail/expanded view.

### 1.5 Storage strategy for multiple images

No new storage system. Same Drive Shared Drive, same `uploadPhoto()` function, called N times per
submission (N ≤ 10). Each photo is its own independent Drive file with its own public-read permission
and its own proxied `/photos/:id` URL — exactly like today, just more of them per donation row.

**Compression/resize** (explicit requirement — currently missing even for the single-photo case):
add `expo-image-manipulator` (official Expo SDK package, safe/standard addition) to `mobile-donor`.
Before upload, resize each image so its longest edge is capped (recommend 1600px — large enough for
institutions/recipients to see genuine detail/damage on a car dashboard or odometer, small enough to
keep upload time and Drive storage reasonable) and re-encode as JPEG at `quality: 0.8` (already the
existing convention). This is a pure client-side step before `uploadAsync` — no API change.

### 1.6 Migration / backward-compatibility strategy

- **Fully additive**: new `Photos` column, old `Photo` column untouched and still written (so a
  rollback to pre-V2 code reading only `Photo` still works during any transition window — see below).
- **No backfill needed**: `rowToDonation`'s fallback (`Photos` blank → derive `[Photo]`) means every
  historical row keeps working with zero data migration. No script needs to run against the live
  Sheet.
- **Write-side transition**: on create/edit, write **both** `Photo` (= new `Photos[0]`) and `Photos`
  (the full array) for one release cycle, even though only `Photos` is strictly needed going forward.
  This means if the mobile-donor rebuild ships before the API redeploy somehow reorders (shouldn't
  happen with Render's deploy model, but EAS builds and Render deploys are decoupled systems), neither
  side breaks. Can drop the redundant `Photo` write in a later cleanup once confirmed stable.
- **Old mobile-donor build compatibility**: a donor still running the current (pre-V2) TestFlight/Play
  build sends `photo` (singular). The backward-compat wire handling in §1.3 means this keeps working
  against the new API without forcing every existing installed build to update simultaneously.

### 1.7 Testing strategy

- Unit-level (via the same disposable-test-account HTTP pattern used throughout this session):
  create a donation with 1 photo (legacy shape), 10 photos (max), 11 photos (must reject), 0 photos
  (must reject) — against the real route, not just the service function.
  - Confirm a **pre-existing** donation row (blank `Photos` cell) still round-trips correctly through
  `GET /donations/mine` and shows exactly 1 photo.
- Manual device/simulator pass: DonateScreen photo picker (add up to 10, remove, change cover,
  submit), gallery viewer on all 3 consuming screens (MyDonations, AvailableDonations, Receber),
  Admin web donation detail.
- Confirm Institution's claim/deliver flow (unrelated fields) is untouched — regression check only,
  no logic there depends on `Photo`.

### 1.8 Files to be modified

```
packages/shared/src/types/donation.ts          — add Photos: string[]
apps/api/src/services/donations.ts             — rowToDonation, createDonation, editDonation,
                                                   assertValidDonationFields
apps/api/src/routes/donations.ts                — upload.single → upload.array on POST + PATCH
apps/mobile-donor/src/screens/DonateScreen.tsx  — multi-photo picker, reorder-via-cover-swap, remove,
                                                   compression, submit payload
apps/mobile-donor/src/screens/MyDonationsScreen.tsx        — gallery viewer
apps/mobile-institution/src/screens/AvailableDonationsScreen.tsx — gallery viewer
apps/mobile-institution/src/screens/HomeScreen.tsx          — none expected (uses list counts only)
apps/mobile-donor/src/screens/ReceberScreen.tsx             — gallery viewer
apps/admin/src/app/donations/page.tsx           — gallery viewer in detail viewer
apps/mobile-donor/package.json                  — add expo-image-manipulator
i18n locale files (pt/en, both apps)            — new strings (add photo, remove, make cover, gallery)
```

---

## 2. Feature: GPS-Based Donation Distance

### 2.1 ⚠️ Architectural finding that changes the feature's scope — read before anything else

The request's own example (donor in Porto, recipient in Lisboa) maps cleanly onto **Institution and
Animal_Shelter** claims, but **does not map the same way onto the People/RECEBER flow**, for a reason
specific to how RECEBER already works:

- `Institution.Location` (a real `GeoPoint`, captured once at registration) already exists and is
  already available server-side and client-side (`GET /institutions/me`). Distance = donor's
  `Donation.Location` vs the claiming institution's own `Location`. **This part of the feature is
  straightforward and has no missing data.**
- For **People-category (RECEBER) donations, the individual recipient never travels to the donor's
  location at all.** Confirmed in `apps/api/src/services/collection-points.ts` and
  `ReceberScreen.tsx`: every country has exactly **one fixed Wafina-run Collection_Point**
  (`Collection_Points` sheet, one row per country), and a Pessoa always picks up from that same fixed
  address regardless of which donation they reserved. The donor's own `Donation.Location`/`Address` is
  shown to the recipient only as informational context — it is not a place the recipient goes to.
- **Also**: `User` (the shared type backing every Donor account) has **no location field at all** —
  only `Home_Country_ID`/`Active_Country_ID` (country-level, not coordinates). There is nowhere in the
  schema today to read "where is this individual recipient" from, unlike Institution.

**What this means for the People category**: a per-donation "this is 60km from you" prompt as
literally described doesn't have a natural referent — the fixed pickup point is the same physical
place no matter which of the browsable donations they're looking at, so the distance would be
identical across every card in RECEBER for a given recipient, not something that varies "this
donation is closer than that one." The more coherent version of this feature for People is: **"the
collection point is X km from you"**, shown once (e.g. on the collection-point card already in
`ReceberScreen`), not per-donation.

**I did not implement either interpretation — this needs your call before I build anything for the
People category.** Options, roughly in order of how much they change existing product behavior:

1. **Scope the distance/confirmation feature to Institution + Animal_Shelter only for V2.** People
   already has a fundamentally different, already-solved logistics model (fixed collection point);
   this reframes "V2 GPS distance" as fully solving the two categories where it's a real per-donation
   variable, and treats RECEBER's collection-point distance as a separate, smaller, already-scoped
   addition (see option 3) rather than forcing it into the same per-donation confirm-dialog shape.
2. **Redefine RECEBER's donor-delivers logistics** so the donor delivers to the collection point (not
   the recipient's home), and show the donor (not the recipient) a distance/feasibility check against
   the collection point at submission time. This is a bigger product change to how RECEBER
   already works today and would need explicit confirmation it's actually what's wanted, since it
   changes who sees the warning and when.
3. **Add a simple, always-visible "Collection point is X km from you" line** to the existing
   collection-point card in `ReceberScreen` (using a one-time, ephemeral GPS read — see §2.3), with no
   per-donation variation and no confirm/deny dialog (since there's nothing to choose between — every
   donation shares the same pickup point). Smallest, least risky addition; doesn't fully deliver a
   "Yes, Claim / No, Go Back" prompt for RECEBER specifically, but is honest about what data actually
   varies.

**Recommendation: option 1 + option 3 together** — build the full Institution/Animal_Shelter distance
+ confirm-dialog feature now (that's where the stated problem genuinely exists), and add the simpler
informational collection-point distance line to RECEBER as a smaller companion piece, without forcing
a per-donation confirm dialog where the underlying data doesn't actually vary per donation. I'd like
your explicit sign-off on this scoping before writing any RECEBER-side code — happy to build option 2
instead if that's actually the intended product direction, but it's a materially bigger change I don't
want to guess into.

The rest of this section (§2.2 onward) plans the Institution/Animal_Shelter side in full, and treats
the RECEBER side per the recommended option 3 unless you say otherwise.

### 2.2 Current architecture findings (continued)

- No haversine/distance-calculation function exists anywhere in the codebase today (confirmed via
  repo-wide search). This is new code, not a modification of existing logic.
- `Institution.Service_Radius_Km: number | null` already exists in the schema, explicitly commented
  *"Optional radius in km, for future donor/institution matching. Kept simple by design."* — this is
  clear precedent that distance-based matching was already anticipated at the schema level, just never
  built. Worth deciding whether the new distance feature should **read** this field (e.g., flag/badge
  when a donation falls outside the institution's own stated service radius) in addition to the
  confirm-dialog — that would directly fulfill the field's original intent. Flagging as a nice-to-have,
  not required for the core ask.
- Existing precedent for **ephemeral, non-persisted GPS**: `packages/shared/src/lib/geo-detect.ts`'s
  `detectSupportedCountryFromCoords()` — explicitly documented as "a live signal computed client-side
  each session... never persisted, since storing it would just be a stale snapshot." This is the
  pattern to follow for any location read that isn't already a stored field (i.e., anywhere the
  *institution's own* claim-time position might matter beyond its registered `Location`).
- The claim action itself (`onClaim` in `AvailableDonationsScreen.tsx`) is currently a direct,
  no-confirmation single tap → `POST /donations/:id/claim`. Same for RECEBER's `onSelect` →
  `POST /donations/:id/reserve`. Neither has any confirm step today — the distance dialog is a new UI
  state, not a modification of an existing one.
- `claimDonation`/`reserveDonationForIndividual` (`services/donations.ts`) already do defense-in-depth
  re-validation of category/country server-side even though the list is pre-filtered — same pattern
  should extend to distance if a maximum-distance hard limit is ever introduced (it isn't, per your
  explicit "do not auto-reject" instruction — noted below).

### 2.3 Recommended data model

**No schema changes required for Institution/Animal_Shelter.** Both `Donation.Location` and
`Institution.Location` already exist. Distance is a *computed* value, not stored data — recompute on
every list fetch (positions don't change fast enough, and institutions are relatively few, so this is
cheap; no caching complexity needed).

New shared utility (no existing file is a natural fit — recommend a new
`packages/shared/src/lib/distance.ts`):
```ts
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number
```
Pure function, zero dependencies, usable both server-side (API) and client-side (mobile) — matching
how `geo-detect.ts` is already shared across both.

New shared config (also `packages/shared/src/lib/distance.ts` or a sibling
`distance-thresholds.ts`) for the tiering the request asks for:

```ts
export const DISTANCE_THRESHOLDS_KM = {
  nearby: 10,      // no visual treatment beyond showing the number
  notable: 30,      // show distance plainly, no warning tone
  warn: 75,          // confirm dialog, neutral/informational tone
  farWarn: 150,     // confirm dialog, stronger warning tone/copy
} as const;
```

**Why these numbers, not the ones in your example verbatim**: your example used 5/20/60/150 — I'm
recommending broadly similar but slightly adjusted breakpoints (10/30/75/150) based on the actual
geography of the countries this platform operates in today (Portugal mainland is ~560km
north-south/~220km east-west per `geo-detect.ts`'s own bounding box; Cabo Verde is an island nation
where even 30km can cross water between islands and be effectively impossible; Angola and Mozambique
are much larger than Portugal). A single fixed km scale doesn't mean the same thing in every one of
the 5 supported countries. **Recommend making this a named export others can override, not hardcoded
inline in the dialog component** — low effort now, and avoids a second refactor if per-country tuning
turns out to matter later (e.g. Cabo Verde likely wants tighter thresholds than Angola). Not
recommending building actual per-country config yet — that's speculative until real usage data says
it's needed — just keeping the one config point structured so it's an easy follow-up rather than a
rewrite.

### 2.4 API changes

- `InstitutionDonationView` (extends `Donation`): add `Distance_Km: number | null` — null only if
  either side's location is somehow invalid (shouldn't happen given both are already required fields
  today, but defensive).
- `listAvailableDonations()` (`services/donations.ts:798-814`) and
  `listDonationsClaimedByInstitution()`: compute `Distance_Km` via `haversineDistanceKm(row.Location,
  institution.Location)` when building each `InstitutionDonationView`. Function signature needs the
  institution's own `Location` passed in (already fetched by the route via `requireOwnInstitution`) —
  small signature change, not a new lookup.
- `claimDonation()`: **no server-side distance gate** — per your explicit instruction ("do not
  automatically reject distant donations"), this stays a display+confirm concern only. The server does
  not need to know or care about the confirmation; the client simply doesn't call `/claim` until the
  user confirms. No API contract change to the claim endpoint itself.
- New `GET /donations/:id/distance` is **not needed** — distance is already computed as part of the
  list response the claim screen already has loaded; no extra round-trip required at claim time.

### 2.5 Mobile UI changes

`AvailableDonationsScreen.tsx` (mobile-institution):
- Card gains a distance line (e.g. "📍 32 km" under the existing City/Address text), always visible —
  per your "distance is a decision factor, not simply a filter" principle, this is shown for every
  card, not just far ones.
- `onClaim` becomes two-step: tapping "Aceitar"/claim button opens a confirm modal/`Alert` when
  distance ≥ the `warn` threshold (below that, claim proceeds immediately — showing a dialog for a 3km
  donation would just be noise). Modal copy scales with tier per §2.3 (neutral at `warn`, stronger
  wording at `farWarn`), showing the two locations' labels (donor's City/Address vs the institution's
  own registered address) and the two buttons: "Sim, Aceitar" / "Não, Voltar". Only calls the existing
  `/claim` endpoint after explicit confirm — exactly matching your "only finalize after confirmation"
  requirement.
- Optional filter chip: "Ordenar por distância" alongside the existing delivery-method filter — natural
  fit now that distance is on every card, but not strictly required by your spec; flagging as an easy
  add-on if wanted.

`ReceberScreen.tsx` (mobile-donor): per §2.1's recommendation, only the smaller informational
addition — the collection-point card gains a "📍 X km do ponto de recolha" line, computed from a
one-time `expo-location` read (same permission flow `DonateScreen` already uses) against the
collection point's stored `Address` (would need geocoding once, or storing `Collection_Points.Location`
as a `GeoPoint` — currently it only has a text `Address`; **this is a small additive schema change to
`Collection_Points`** if this option is approved). No confirm dialog (nothing to choose between).

Donor-side transparency (your "donor should also be informed" note): `DonateScreen`'s existing
location-confirmation UI ("Localização confirmada") already tells the donor their pickup point was
captured — recommend no change needed there specifically, but `MyDonationsScreen`'s donation card
could show "Aceite por uma instituição a 32km de si" once claimed, using the same `Distance_Km` the
claiming institution saw (already computed, just needs surfacing in `listDonationsByDonor`'s response
too — small addition, same computation, different caller).

### 2.6 GPS/distance calculation approach

- **Institution/Animal_Shelter**: pure haversine (great-circle distance) between two already-stored
  `GeoPoint`s. No live GPS read needed at claim time — the institution's registered `Location` is
  authoritative (same trust model as Institution's identity/verification already work: set once,
  locked, not re-read live every session).
- Haversine (not a routing/driving-distance API): matches the existing codebase's "no paid external
  geo services yet" posture (`geo-detect.ts`'s comment about avoiding a geocoding API dependency until
  proven necessary) and needs zero new API keys/vendors/cost — appropriate for the current scale.
  Flagging as a known simplification: haversine is straight-line distance, not driving distance, so a
  60km straight-line figure could be a much longer real drive around water/mountains. Acceptable for a
  V2 "is this even remotely practical" gut-check; would need revisiting only if users report the
  numbers being meaningfully misleading in practice.
- **Individual/RECEBER** (if option 3 is approved): one-time `expo-location` read at the moment
  `ReceberScreen` loads, same permission-request pattern already used in `DonateScreen`. Not persisted
  to `Users` (per the ephemeral-GPS precedent in §2.2) — computed and discarded each session.

### 2.7 Storage strategy

None needed beyond what's listed in §2.5 (`Collection_Points.Location` addition, only if option 2/3
for RECEBER is approved). Everything else is computed-on-read.

### 2.8 Migration / backward-compatibility strategy

- **Fully additive.** `Distance_Km` is a new field on response types only — no existing field changes
  shape or meaning. Old mobile builds that don't know about `Distance_Km` simply ignore the extra JSON
  field (standard REST tolerance) and keep working exactly as today (no confirm dialog, direct claim)
  until they're rebuilt.
- **No existing donation/claim data is touched** — this is a display+confirmation layer in front of
  the existing, unmodified `claimDonation`/`reserveDonationForIndividual` functions.
- No Sheets migration script needed (Institution/Donation `Location` data already exists on every row
  that needs it).

### 2.9 Testing strategy

- Unit-level: `haversineDistanceKm()` against known city-pair distances (e.g. Porto↔Lisboa ≈ 274km
  straight-line, sanity-checkable against a public reference) to confirm the formula itself is
  correct before any UI depends on it.
- HTTP-level (same disposable-account pattern used throughout this session): create a donation at a
  known coordinate, claim-list it as an institution at a known different coordinate, assert
  `Distance_Km` matches the expected haversine value within rounding tolerance.
- Threshold-tier UI check: manually verify the confirm dialog appears/doesn't appear at values on
  either side of each configured threshold, and that tapping "Não, Voltar" never calls `/claim`.
- Regression: confirm a claim well under the `warn` threshold still completes with zero extra taps
  (no dialog shown) — the feature must not add friction to the common, nearby case.

### 2.10 Files to be modified

```
packages/shared/src/lib/distance.ts             — NEW: haversineDistanceKm + threshold constants
packages/shared/src/types/donation.ts           — Distance_Km on InstitutionDonationView
apps/api/src/services/donations.ts              — compute Distance_Km in listAvailableDonations,
                                                    listDonationsClaimedByInstitution,
                                                    listDonationsByDonor (donor-side transparency)
apps/mobile-institution/src/screens/AvailableDonationsScreen.tsx — distance display + confirm dialog
apps/mobile-donor/src/screens/MyDonationsScreen.tsx               — "accepted X km from you" line
i18n locale files (pt/en, mobile-institution + mobile-donor)      — new distance/confirm-dialog strings

If RECEBER option 3 is approved, additionally:
packages/shared/src/types/collection-point.ts   — add Location: GeoPoint
apps/api/src/services/collection-points.ts      — geocode/store Location per country (one-time,
                                                    5 countries — likely just a manual data entry,
                                                    not a code migration)
apps/mobile-donor/src/screens/ReceberScreen.tsx — collection-point distance line
```

---

## 3. Cross-cutting risks & open questions

1. **§2.1 is the big one** — RECEBER's fixed-collection-point model means the feature as literally
   specified doesn't have a natural per-donation meaning for individuals. Needs your explicit scoping
   decision before any RECEBER-side code is written. Institution/Animal_Shelter has no such ambiguity
   and can proceed as specified.
2. **Reorder UX substitution** (§1.4) — recommending "tap to make cover" instead of full drag-to-reorder
   to avoid a new drag-and-drop dependency. Delivers the actual requirement (choose cover, remove
   unwanted photos) at lower implementation risk. Flagging for explicit sign-off rather than assuming.
3. **Haversine vs. real routing distance** (§2.6) — straight-line only, no paid geocoding/routing API.
   Consistent with the codebase's existing zero-external-geo-dependency posture, but worth knowing the
   number shown is "as the crow flies," which can meaningfully understate real travel distance/time in
   places with water crossings or mountainous terrain (Cabo Verde's inter-island case especially).
4. **Mobile rebuild required for both features** — same as the two fixes shipped earlier this session:
   neither feature reaches real users until mobile-donor (both) and mobile-institution (distance
   feature) get fresh EAS builds + resubmission. Purely a sequencing/timing consideration, not a
   blocker — noting it now so it's factored into whenever you approve implementation.
5. **Multer total-payload size** — 10 photos × 8MB theoretical max = up to 80MB per donation
   submission. Real photos rarely hit the 8MB single-file cap, but worth confirming Render's request
   size limits (and mobile network upload time on a poor connection) are acceptable before committing
   to "10" as the max — happy to also add client-side sequential-upload-with-progress if 10
   simultaneous large files proves slow in practice, rather than a single monolithic multipart request.
6. **`Service_Radius_Km` currently unused** (§2.2) — not required by your spec, but sitting right there
   as an already-planned-for field. Worth a yes/no on whether V2 should also surface "outside this
   institution's stated service radius" as a distinct signal from the general distance number, or
   leave that field for a future pass.

---

## 4. Explicit non-changes (per your constraints)

Confirmed these are **not** touched by this plan and won't be touched during implementation:
EAS credentials, signing keys, App/package IDs, store assets (screenshots/listings/icons), and any
production configuration unrelated to these two features. All changes above are application code
(shared types, API services/routes, mobile screens) and, if approved, ordinary Sheets schema additions
(new columns), not infrastructure/credentials.

---

**Waiting for your review and explicit approval before writing any implementation code**, per your
instruction — particularly your decision on §2.1 (RECEBER scoping) and the two flagged substitutions
in §3.2/§3.3, since those affect what gets built, not just how.
