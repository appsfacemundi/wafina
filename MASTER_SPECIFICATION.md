# WAFINA — MASTER SPECIFICATION
## Reference Implementation: AppSheet + Google Sheets
### STATUS: FINAL

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 Project Name
**Wafina** — a nonprofit donation-matching platform connecting individual and institutional donors of
physical goods — perishable (fresh food, prepared meals) and non-perishable (clothing, school supplies,
hygiene items, packaged groceries, household essentials) alike — with verified charitable institutions.
*(Scope broadened from non-perishable-only during RC1 Phase 3, 2026-08-02, stakeholder-approved Feature
Freeze exception — see `RC1_RELEASE_ROADMAP.md`.)*

## 1.2 Problem Statement
Charitable donation coordination currently happens through informal, manual channels — physical drop-off points, word-of-mouth coordination between donors and institutions (orphanages, NGOs, churches). This creates no visibility into institution needs, no delivery tracking, no verification of legitimacy, and no accountability trail when disputes arise.

## 1.3 Solution Overview
Three connected applications sharing one central database:

| App | Audience | Core Function |
|---|---|---|
| **Wafina Doador** (Donor App) | Individual & Corporate/CSR donors | Submit donations, track status |
| **Wafina Instituição** (Institution App) | Verified charitable institutions | Browse/claim donations, confirm receipt, raise disputes |
| **Wafina Admin** (Admin Panel) | Internal administrators | Verify institutions, resolve disputes, full oversight |

## 1.4 Reference Implementation Status
A working, tested prototype exists as three AppSheet apps connected to one Google Sheets database ("Wafina Database"). Core workflows have been built and functionally verified.

## 1.5 Confirmed Scope Decisions

1. **Geography:** Angola is the starting/default market, expanding to other Portuguese-speaking countries (Portugal, Brazil) and global diaspora communities. **Currency varies by country/region** — handled as a localized setting, not hardcoded.
2. **Business model:** **Nonprofit/NGO.** No monetization, subscriptions, or transaction fees in scope.
3. **Deployment status:** Reference implementation is **still in testing** — no live production user data exists.
4. **Authentication:** Reference uses Google Sign-In (`USEREMAIL()`). Production requires **real, robust authentication** (email/password + OAuth).
5. **Scale:** Exact numbers unknown, but the platform must be architected for **significant long-term growth**, not constrained by Google Sheets' limits.
6. **Known issues:** Documented in the Appendix at the end of this document, not scattered inline.

---

# SECTION 2: PLATFORM OBJECTIVES

## 2.1 Primary Objective
Enable donors to donate physical non-perishable goods directly to verified charitable institutions, with full lifecycle visibility (submission → claim → delivery), institution verification for trust, and dispute resolution for accountability.

## 2.2 Core Objectives
1. Digitize donation coordination (submit → claim → confirm delivery)
2. Institution verification prevents impersonation/fraud
3. Full donation lifecycle transparency for donors
4. Formal dispute resolution mechanism
5. Strict privacy-respecting data access per role
6. Impact visibility (items received per institution)
7. Multi-language readiness (Portuguese primary; extensible)
8. Multi-currency readiness for future phases (no active payment processing now)

## 2.3 Confirmed Scope Decisions
1. **Monetary donations:** **Out of scope.** Physical goods only. No payment gateway.
2. **Institution types:** Open/extensible category — any organization type reasonably fitting a charitable-recipient role (orphanages, NGOs, churches, schools, community centers, etc.).
3. **Success metrics:** Not yet defined by the organization — Sections 20/21 expose reportable data without prescribing fixed KPI targets.
4. **Cross-border/diaspora donations:** **Future phase.** Long-term vision includes an **airline logistics partnership** enabling international shipping of donated goods. Current schema must not preclude this (extensible Donation_Type/logistics fields) but full shipping workflow is not part of the current build.

---

# SECTION 3: COMPLETE USER ROLES

## 3.1 Role Overview
Single shared **Users** table with a `Role` field. Three roles, three separate applications.

| Role | Application | Registration |
|---|---|---|
| Donor (Individual or Corporate/CSR) | Wafina Doador | Self-registration |
| Institution | Wafina Instituição | Self-registration + mandatory Admin verification |
| Admin | Wafina Admin | Provisioned directly (internal only) |

## 3.2 Role: Donor
**Capabilities:** Register/sign in, submit donations, view own donation history/status, browse verified institutions read-only.
**Restrictions:** No visibility into other donors' data, institution verification internals, or dispute resolution tools. Cannot edit a donation once claimed.

## 3.3 Role: Institution
**Capabilities:** Register/sign in, manage own profile (subject to field-locking post-verification), browse/claim available donations, confirm receipt, raise disputes, view own impact totals.
**Restrictions:** **Fully blocked from the app until Verified = TRUE** (confirmed decision — no partial pre-verification access). Cannot see other institutions' internal data.

## 3.4 Role: Admin
**Capabilities:** Full unfiltered oversight of Users, Donations, Institutions, Disputes. Approve/reject institutions. Resolve disputes. Directly edit/correct any donor or institution data.
**Restrictions:** Internal-only, never published to app stores.

## 3.5 Confirmed Scope Decisions
1. **Institution verification:** Full app block until verified (not partial access) — confirmed.
2. **Multiple admins:** Single admin acceptable for now; architecture must not preclude adding more later. No sub-roles required at this stage.
3. **Donor sub-types:** **Confirmed split** — Individual Donor and Corporate/CSR Donor, with Corporate Donors receiving **full equal privileges** among all users tied to the same account (company dashboard, multiple team members, no internal hierarchy).
4. **Role transitions:** **One role per person** — no multi-role accounts. Confirmed as intended design.

---

# SECTION 4: USER PERMISSIONS

## 4.1 Permission Matrix

| Action | Individual Donor | Corporate Donor | Institution (Unverified) | Institution (Verified) | Admin |
|---|---|---|---|---|---|
| Register/Sign in | ✅ | ✅ | ✅ | ✅ | N/A |
| Access app pre-verification | N/A | N/A | ❌ Full block | N/A | N/A |
| Submit donation | ✅ | ✅ | ❌ | ❌ | ❌ |
| View own donation history | ✅ | ✅ (company-wide) | ❌ | ❌ | ✅ (all) |
| Browse institutions | ✅ read-only | ✅ read-only | ❌ | ✅ own + relevant | ✅ all |
| Edit own institution profile | ❌ | ❌ | ❌ | ✅ pre-lock, then via Admin only | ✅ all |
| Browse available donations | ❌ | ❌ | ❌ | ✅ | ✅ oversight |
| Claim donation | ❌ | ❌ | ❌ | ✅ | ❌ |
| Confirm receipt | ❌ | ❌ | ❌ | ✅ own claims | ✅ oversight |
| Raise dispute | ❌ | ❌ | ❌ | ✅ own claimed/delivered only | ❌ |
| View own dispute status/resolution | — | — | ❌ | ✅ | — |
| Resolve disputes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve/verify institutions | ❌ | ❌ | ❌ | ❌ | ✅ |
| View/edit all Users/Donations/Institutions | ❌ | ❌ | ❌ | ❌ | ✅ |

## 4.2 Confirmed Scope Decisions
1. **Dispute visibility:** Institutions **can see the status and resolution** of disputes they raised (in-app, via "My Disputes").
2. **Corporate Donor permissions:** Full privileges confirmed — company dashboard + multiple equal team members.
3. **Admin data authority:** Admin **can directly edit/correct** any donor or institution data — full data steward role, not limited to approval/resolution only.
4. **Institution field-locking:** **All institution profile fields lock automatically upon verification.** Institution cannot self-edit; must go through Admin (who edits directly or temporarily unlocks specific fields, then re-locks).

---

# SECTION 5: DATABASE DESIGN

## 5.1 Design Principles
- Single Users table, one Role per person
- Physical goods only — no payment fields
- Field-by-field locking mechanism for Institution profiles (more precise than whole-profile locking, reduces accidental changes)
- Corporate Donor structure: one company entity, multiple equal-privilege user logins
- Currency/locale deferred (no active use currently)

## 5.2 Core Entities (Final)

### Users
- User_ID (PK), Name, Phone, Country, Role, Donor_Subtype (Individual/Corporate), Corporate_Account_ID (FK, nullable), Verified, Email, Date_Joined

### Corporate_Accounts (NEW)
- Corporate_Account_ID (PK), Company_Name, Country, Date_Created

### Donations
- Donation_ID (PK), Donor_ID (FK), Donation_Type (fixed/hidden value, reserved for future monetary phase), Item_Type, Quantity, Condition, Photo, Location, Status, Claimed_By_Institution_ID (FK, nullable), Date_Submitted, Date_Claimed, Date_Delivered

### Institutions
- Institution_ID (PK), User_ID (FK, unique), Name, Logo, Type, Location, Needs_List, Verified, Rejection_Reason, Total_Items_Received (calculated), **Locked_Fields** (field-by-field lock mechanism)

### Disputes
- Dispute_ID (PK), Donation_ID (FK), Raised_By (FK → Users, formalized from Text), Issue_Description, Status, Resolution_Notes (NEW), Date_Raised, Date_Resolved (NEW)

### Change_Requests (NEW)
- Request_ID (PK), Institution_ID (FK), Field_Requested, Reason, Status, Date_Requested, Date_Resolved

## 5.3 Confirmed Scope Decisions
1. **Corporate team structure:** All team members share equal, full privileges — no hierarchy.
2. **Donation_Type field:** Kept but hidden/hardcoded for forward compatibility.
3. **Institution locking granularity:** **Field-by-field**, not whole-profile.
4. **Photo storage:** Continue using Google Drive/AppSheet file storage — no migration to separate cloud storage required at this stage.
5. **Multi-currency:** Deferred entirely.

---

# SECTION 6: GOOGLE SHEETS STRUCTURE (VERIFIED — directly inspected)

## 6.1 Table: Users (qualifier: Users, source: Wafina Database)
_RowNumber, User_ID (Key), Name, Phone, Country, Role, Verified, Date_Joined, Email (PII), Related Donations (virtual), Related Institutions (virtual)

## 6.2 Table: Donations (qualifier: Donations, source: Wafina Database)
_RowNumber, Donation_ID (Key), Donor_ID (Ref), Donation_Type (Enum), Item_Type, Quantity, Condition, Photo (Image), Location (LatLong), Date_Submitted, Status, Date_Claimed, Claimed_By_Institution_ID (Ref), Date_Delivered, Related Disputes (virtual)

## 6.3 Table: Institutions (qualifier: Institutions, source: Wafina Database)
_RowNumber, Institution_ID (Key), User_ID (Ref), Name, Type (Enum), Location (LatLong), Verified, Needs_List, Logo (Thumbnail), Rejection_Reason, Related Donations (virtual), Total_Items_Received (calculated), Related _Per User Settings (virtual)

## 6.4 Table: Disputes (qualifier: Disputes, source: Wafina Database)
_RowNumber, Dispute_ID (Key), Donation_ID (Ref), Issue_Description (LongText), Status, Date_Raised, Raised_By (Text, PII)
**Confirmed gap:** Resolution_Notes and Date_Resolved do not yet exist — required additions per Section 5.

## 6.5 Data Source Verification
All four tables in Wafina Admin confirmed correctly connected to "Wafina Database" (qualifier names match tabs exactly). A previously-found mismatch in a different app (Wafina Doador's Users table pointing to a separate file) was corrected during development — should be independently re-verified before production migration.

---

# SECTION 7: TABLE RELATIONSHIPS

## 7.1 Relationship Definitions (Final)

| Relationship | Type | Foreign Key | Constraint |
|---|---|---|---|
| Users → Donations | 1:Many | Donations.Donor_ID | — |
| Users → Institutions | 1:1 | Institutions.User_ID | **Unique constraint required** |
| Institutions → Donations | 1:Many | Donations.Claimed_By_Institution_ID | Nullable; **cascade on delete: clear + Status="Pending"** |
| Donations → Disputes | 1:Many | Disputes.Donation_ID | — |
| Users → Disputes | 1:Many | Disputes.Raised_By | **Formalized as Ref → Users** (was Text) |
| Corporate_Accounts → Users | 1:Many | Users.Corporate_Account_ID | — |
| Institutions → Change_Requests | 1:Many | Change_Requests.Institution_ID | — |

## 7.2 Confirmed Scope Decisions
1. **Disputes.Raised_By:** Formalized as a true foreign key (Ref → Users), replacing Text type.
2. **Duplicate Institution_ID (found in test data):** Logged as known issue (Appendix), not patched in test data — production migration must enforce uniqueness validation instead.
3. **One-to-One Users↔Institutions:** Required as both application-level validation and database-level unique constraint.
4. **Cascade on Institution deletion:** **Confirmed — reverts affected Donations to Pending status**, clearing Claimed_By_Institution_ID. Implemented as an automated cascade (Section 24).

---

# SECTION 8: APPSHEET ARCHITECTURE

## 8.1 Three-App Structure
All three apps connect to the same "Wafina Database" Google Sheet, each with independent Views/Actions/Slices/Security Filters.

## 8.2 Authentication (verified)
Google Sign-In via `USEREMAIL()`. "Require user sign-in" confirmed enabled in Wafina Admin. Identity resolution pattern: `LOOKUP(USEREMAIL(), "Users", "Email", "<field>")`.

## 8.3 Security Filters (verified state, Wafina Admin)
Users/Donations/Institutions: `USEREMAIL()="<admin email>"`. Disputes: pending configuration at time of writing.
**Known limitation:** hardcodes a single admin email because AppSheet blocks a table's Security Filter from referencing that same table. This is a reference-implementation-only workaround, not to be replicated in production.

## 8.4 Known AppSheet Platform Constraints
1. Slice-sourced Ref dropdowns don't always visually filter their picker UI (validated via "Valid If" instead)
2. A table's Security Filter cannot reference that same table
3. Google Sheets has no native unique-key/foreign-key/cascade support

## 8.5 Confirmed Scope Decisions
1. **Admin authentication:** Current single-email approach **remains acceptable for now**, may become Role-based later if needed.
2. **App store publication scope:** **Only Donor and Institution apps** will be published (Android/iOS/Web). **Admin remains permanently on AppSheet** — not part of the production build scope.
3. **AppSheet's ongoing role:** Confirmed — Admin stays on AppSheet indefinitely; Donor/Institution migrate to the new production database.
4. **Bots/Automations:** Confirmed — will be used (notifications, reminders, etc.) going forward; must be reimplemented in the new backend for Donor/Institution apps since they leave AppSheet, while Admin's bots can remain AppSheet-native.

## 8.6 Architecture Summary

```
Wafina Doador (Web+Android+iOS) ─┐
                                  ├──► Production Database (new)
Wafina Instituição (Web+Android+iOS) ─┘         │
                                                 │ Real-time sync
                                                 ▼
                                        Wafina Admin (AppSheet,
                                        reads Google Sheets)
```

---

# SECTION 9: SCREEN-BY-SCREEN DOCUMENTATION

## 9.1 Wafina Doador — Final Screen Inventory
| Screen | Status |
|---|---|
| Onboarding/Welcome (incl. language selection) | NEW |
| Sign In | Existing (to be upgraded, Section 14) |
| Doar (Donate) | Existing |
| My Donations | Existing |
| Institutions (browse) | Existing |
| Success Stories/Impact Gallery | NEW (consent-gated) |
| Settings | NEW |
| Notifications/Inbox | NEW |

## 9.2 Wafina Instituição — Final Screen Inventory
| Screen | Status |
|---|---|
| Onboarding/Welcome (incl. language selection) | NEW |
| Sign In | Existing (to be upgraded) |
| Verification Status | NEW |
| Available Donations | Existing |
| Search/Filter | NEW |
| Claimed by Me | Existing |
| Institution Profile (field-locked) | Existing (locking logic new) |
| Request Change | NEW |
| Raise a Dispute | Existing |
| My Disputes | NEW (documented only, built in production) |
| Settings | NEW |
| Notifications/Inbox | NEW |

## 9.3 Confirmed Scope Decisions
1. Admin continues reading Google Sheets in **real-time sync** (finalized in Section 26).
2. Additional screens above adopted per stakeholder request for best-practice expansion beyond as-is documentation.
3. "My Disputes" documented as a requirement only — to be built directly in production by Claude Code, not first prototyped in AppSheet.
4. Section 9 uses summarized purpose-tables; granular field/validation detail lives in Sections 11–12.

---

# SECTION 10: NAVIGATION FLOW

## 10.1 Donor App
```
Launch → Signed in? → No: Sign In → Onboarding (language, first-time)
                    → Yes: Home
Home tabs: Doar | My Donations | Institutions | Notifications | Settings
```

## 10.2 Institution App
```
Launch → Signed in? → No: Sign In → Onboarding
                    → Yes: Verified? → No: Verification Status ONLY (full block)
                                     → Yes: Home
Home tabs: Available Donations | Claimed by Me | Profile | My Disputes | Notifications | Settings
```

## 10.3 Confirmed Scope Decisions
1. Post-verification notification: **in-app + email**, both triggered automatically.
2. Field-change requests: **formal in-app "Request Change" mechanism**, creating a record in Admin's queue.
3. Notifications: **deep-link directly** to the relevant record/screen.
4. Language selection: **dedicated onboarding step**, editable later in Settings.

---

# SECTION 11: BUSINESS LOGIC

## 11.1 Donation Lifecycle
1. Submit → Status=Pending, Date_Submitted auto, Location auto-captured (fallback: prompt donor to manually confirm if GPS fails, block submission until valid), Donor_ID resolved from identity.
2. While Pending: donor may edit; locks once Claimed.
3. Verified institution claims → Status=Claimed, Claimed_By_Institution_ID set, Date_Claimed auto; disappears from other institutions' Available Donations.
4. Institution confirms → Status=Delivered, Date_Delivered auto.
5. If claiming Institution deleted before delivery → Claimed_By_Institution_ID cleared, Status reverts to Pending.

## 11.2 Institution Verification
1. Register → Verified=FALSE.
2. Full app block except Verification Status screen.
3. Admin approves (Verified=TRUE, notified in-app+email) or rejects (Rejection_Reason shown).
4. Post-verification: all profile fields locked field-by-field; changes require Admin action or a Request Change.

## 11.3 Disputes
1. Institution disputes only Claimed/Delivered donations (never Pending).
2. Created → Status=Open, Date_Raised auto, Raised_By resolved from identity (true Ref).
3. Admin resolves → Status=Resolved, Resolution_Notes set, Date_Resolved auto.
4. Institution can view status/resolution anytime via My Disputes.

## 11.4 Corporate Donor
1. Registers with Donor_Subtype=Corporate → linked to Corporate_Account_ID (admin-provisioned, per Section 13).
2. All users sharing that Corporate_Account_ID hold equal, full privileges.
3. Corporate dashboard aggregates all donations across the account.

## 11.5 Change Requests
1. Verified institution submits a request specifying field(s) + reason.
2. Appears in Admin's queue.
3. Admin edits directly, or temporarily unlocks the specific field(s), then re-locks.
4. Marked resolved with timestamp.

## 11.6 Confirmed Scope Decisions
1. **GPS fallback:** Adopted as specified above — standard practice pattern (matches Uber/iFood-style fallback).
2. **Corporate account creation:** **Admin-provisioned, not self-service** — Admin creates the account after a confirmed partnership, generates an invite code; team members self-register under it using that code. Prevents fraudulent "corporate partner" claims.

---

# SECTION 12: VALIDATION RULES

1. **Donation submission:** Item_Type required (controlled/extensible list); Quantity required, positive integer, recommended max 10,000 per submission (admin override available for bulk/corporate); Condition required (controlled list); Photo required; Location required and must be valid non-zero coordinates.
2. **Institution registration:** Name required (min length enforced); Type required; Location required, valid coordinates; Needs_List optional pre-verification.
3. **Uniqueness (production DB):** Institution_ID unique; Users.Email unique; Institutions.User_ID unique.
4. **Dispute submission:** Donation_ID must reference Status=Claimed or Delivered only; Issue_Description required, minimum length enforced.
5. **Field-locking:** Enforced server-side, not merely hidden client-side.

---

# SECTION 13: USER REGISTRATION FLOW

## 13.1 Individual Donor
Download → Onboarding (language) → Sign In → Basic profile (Name, Phone, Country) → immediate full access, no verification required.

## 13.2 Corporate/CSR Donor
Admin provisions Corporate_Account + invite code after partnership confirmed → team member downloads app → Sign In → enters invite code → joins account, Donor_Subtype=Corporate → immediate full access to shared company dashboard.

## 13.3 Institution
Download → Onboarding → Sign In → Institution profile form → submission creates Verified=FALSE record → full app block, routed to Verification Status only → Admin reviews → Approved (full access, notified) or Rejected (Rejection_Reason shown, may resubmit).

---

# SECTION 14: LOGIN PROCESS

## 14.1 Authentication Method
**Email/password + Google/Apple OAuth** (dual options) — standard for apps expanding across regions with varying Google account penetration (notably Apple Sign-In relevance for Brazil/Portugal expansion).

## 14.2 Session Handling
JWT/session-token based; persistent login as default; Role resolved server-side only (never client-determined, prevents privilege escalation).

## 14.3 Password Reset
Standard email-based reset flow (new requirement — Google Sign-In in reference implementation handled this implicitly).

---

# SECTION 15: DONATION WORKFLOW
```
Donor submits (Pending) → Available to all Verified Institutions
     → Institution claims (Claimed) → Donor notified
          → Institution confirms (Delivered) → Donor notified
               → [optional] Institution raises Dispute
                    → Admin resolves → Institution notified
```

---

# SECTION 16: INSTITUTION WORKFLOW
```
Register → Verified=FALSE → BLOCKED (Verification Status only)
     → Admin reviews → Approve (full access, fields locked, notified) 
                      → Reject (Rejection_Reason shown, may resubmit)
     → [ongoing] Browse/Claim/Confirm/Dispute
     → [if profile change needed] Request Change → Admin edits or unlocks temporarily
```

---

# SECTION 17: ADMIN WORKFLOW
```
Verification Queue → Approve/Reject institutions
Dispute Log → Resolve with notes
Change Request Queue → Edit directly or unlock field
All Donations/Institutions/Users → Full oversight, direct correction authority
```

---

# SECTION 18: APPROVAL PROCESSES

| Process | Trigger | Approver | Outcome |
|---|---|---|---|
| Institution Verification | New registration | Admin | Verified=TRUE / Rejection_Reason set |
| Dispute Resolution | Institution raises dispute | Admin | Status=Resolved + Resolution_Notes |
| Change Request | Institution requests field edit | Admin | Direct edit or temporary unlock |

---

# SECTION 19: NOTIFICATION SYSTEM

| Event | Recipient | Channel |
|---|---|---|
| Institution approved | Institution | In-app + Email |
| Institution rejected | Institution | In-app + Email |
| Donation claimed | Donor | In-app |
| Donation delivered | Donor | In-app |
| Dispute resolved | Institution | In-app + Email |
| Change Request resolved | Institution | In-app |
| New matching donation available | Institution | In-app (future-phase smart-matching) |

All notifications deep-link to the relevant record.

---

# SECTION 20: REPORTS
Donations by Status/month/Item_Type/region; Institutions by Verified status/Type/Total_Items_Received; Disputes by Status and average resolution time; Corporate donor cumulative totals per account. No fixed KPI targets defined yet — data exposed for future dashboard/BI use.

---

# SECTION 21: DASHBOARDS
- **Admin Dashboard:** aggregate totals across all reports
- **Corporate Donor Dashboard:** company's cumulative donation history
- **Institution Dashboard:** own Total_Items_Received, claim/delivery history

---

# SECTION 22: SECURITY

- Role-based access control enforced server-side only
- Field-level locking enforced server-side (not just UI-hidden)
- Unique constraints enforced at database level
- Real authentication (email/password + OAuth) replacing USEREMAIL()-only approach
- PII fields (Email, Phone, Raised_By) require equivalent protection in production; encryption at rest recommended
- Admin's Sheets-based access is an intentional, accepted exception given Admin's full-data authority (Section 4.2.3)

---

# SECTION 23: API REQUIREMENTS
Standard REST or GraphQL API layer covering all Section 5 entities. No payment API (out of scope). No shipping/logistics API yet (future phase).

---

# SECTION 24: AUTOMATION REQUIREMENTS
- Notification dispatch automations (Section 19)
- Institution-deletion cascade (revert donations to Pending)
- **Real-time sync: production database → Google Sheets** (for Admin's continued AppSheet access — confirmed final requirement, see Section 26)
- Recommended: reminder automation for institutions pending verification beyond a threshold number of days

---

# SECTION 25: FUTURE IMPROVEMENTS
- Monetary donations (currently out of scope)
- Cross-border shipping via airline partnership
- Smart donation-matching to institution Needs_List
- Push notifications
- Additional admin sub-roles / multi-admin

---

# SECTION 26: PRODUCTION ARCHITECTURE

- **Donor + Institution apps:** new production database (recommend managed relational database, e.g., PostgreSQL, given the strongly relational structure documented in Section 7)
- **Admin:** remains on AppSheet, reading Google Sheets
- **Sync mechanism: REAL-TIME, from day one** (confirmed final decision — not scheduled/batch). Implemented as an event-driven pipeline writing immediately to Google Sheets via its API whenever the production database changes. This is required from the start of the build, including during testing, per stakeholder direction. Implementation must account for Google Sheets API rate limits (queuing/retry logic recommended).
- API layer mediates all client access
- File storage: continue Google Drive-compatible approach (confirmed — no migration to separate cloud object storage required at this stage)

---

# SECTION 27: DEPLOYMENT STRATEGY
Standard CI/CD pipeline; staged rollout — internal test → limited beta in Angola → full Angola launch → expansion markets (Portugal, Brazil, diaspora) per Section 1.5.1.

---

# SECTION 28: ANDROID REQUIREMENTS
Cross-platform framework (React Native or Flutter) recommended given the confirmed Web+Android+iOS scope — single codebase reduces long-term maintenance cost, appropriate for an NGO with limited technical budget. Specific framework choice left as a build-time technical decision.

---

# SECTION 29: iOS REQUIREMENTS
Same cross-platform framework as Android for consistency and cost efficiency. Apple Sign-In required per App Store guidelines (since other social login is offered).

---

# SECTION 30: WEB REQUIREMENTS
Responsive web app, same API backend, full feature parity with mobile apps.

---

# SECTION 31: TESTING STRATEGY
- Unit tests: business logic (Section 11)
- Integration tests: full donation lifecycle, verification workflow
- Data integrity tests: uniqueness constraints — specifically targeting duplicate-key and orphaned-reference bugs found in the reference implementation (Appendix)
- Manual QA: cross-device (Android/iOS/Web) parity testing
- Sync reliability tests: real-time production DB → Sheets pipeline under load

---

# SECTION 32: RELEASE STRATEGY
Phased: Angola-only MVP (Donor + Institution) → real-time Admin sync validated → expansion to Portugal/Brazil markets with localization → future phases per Section 25.

---

# APPENDIX: KNOWN ISSUES FROM REFERENCE IMPLEMENTATION
*(For Claude Code's awareness — these must not be replicated in production)*

1. **Duplicate Institution_ID** (`bdecb4ed` shared by two test records) — production requires unique constraint enforcement to prevent this class of error.
2. **Inconsistent Role values** found in test data (institution names or "Company" instead of standardized Donor/Institution/Admin) — production must enforce Role as a strict controlled enum.
3. **Inconsistent Donation_Type values** ("Bens"/"Dinheiro"/"Bens fisicos" in test data) — production uses a fixed, hidden value only (Section 5.3.2).
4. **Missing Donor_ID** on at least one test donation record — production must make Donor_ID a required, non-nullable field.
5. **Unrealistic Quantity value** (1,122,444 in test data) — production enforces the Section 12 validation bound.
6. **GPS capture silent failure** (0,0 coordinates in test data) — production enforces the Section 11.6.1 fallback behavior.
7. **AppSheet-specific technical quirks** (Security Filter circular-reference restriction, Ref/Slice picker UI limitation) — informational only, not applicable to production architecture.

---

# DOCUMENT STATUS: FINAL

All 32 sections are complete. All decisions are confirmed by the stakeholder or adopted as expert-judgment recommendations with stakeholder approval. This document is ready to be provided to Claude Code as the single source of truth for building the production Wafina platform: Donor App + Institution App across Web, Android, and iOS, with Wafina Admin remaining on AppSheet connected via a real-time synchronization pipeline to the new production database.