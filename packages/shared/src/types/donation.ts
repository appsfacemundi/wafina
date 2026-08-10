import type { DeliveryMethod } from '../enums/delivery-method';
import type { DonationApprovalStatus } from '../enums/donation-approval-status';
import type { DonationStatus } from '../enums/donation-status';
import type { IndividualDonationState } from '../enums/individual-donation-state';
import type { RecipientCategory } from '../enums/recipient-category';
import type { SuccessStoryStatus } from '../enums/success-story-status';
import type { GeoPoint } from './geo-point';

export interface Donation {
  Donation_ID: string;
  /**
   * Institution UX module (2026-07-30) — the only donation identifier ever
   * shown to end users. Format `<CountryCode>-<SequentialNumber>` (e.g.
   * `AO-000125`), unique and never reused per country. Donation_ID (the UUID)
   * remains the internal primary key and is never displayed.
   */
  Public_Donation_Code: string;
  Donor_ID: string;
  /**
   * Fixed/hidden value reserved for a future monetary-donation phase (spec 5.3.2).
   * Confirmed against real data — the API writes 'Bens', matching existing rows.
   * (Real data also contains 'Dinheiro'/'Bens fisicos' from a monetary-donation
   * test row, which is explicitly out of scope per spec 2.3.1 — ignored, not fixed.)
   */
  Donation_Type: string;
  /** Extensible list (spec 12.1) — see enums/item-type.ts for the current known-good set. */
  Item_Type: string;
  Quantity: number;
  /** Extensible list (spec 12.1) — see enums/condition.ts for the current known-good set. */
  Condition: string;
  /**
   * Epic 0.6, 2026-08-06 — who the donation is intended for. Fixed set,
   * required going forward at creation — nullable here (like Institution's
   * Created_At/Review_History) because donations created before this field
   * existed have no value to backfill.
   */
  Recipient_Category: RecipientCategory | null;
  /** Epic 0.6, 2026-08-06 — required going forward; nullable for the same pre-existing-row reason above. */
  Delivery_Method: DeliveryMethod | null;
  /** Google Drive file reference — a public-read, directly viewable URL. */
  Photo: string;
  Location: GeoPoint;
  Status: DonationStatus;
  Claimed_By_Institution_ID: string | null;
  Date_Submitted: string;
  Date_Claimed: string | null;
  /** Institution App Polish module (2026-07-31) — set when the institution marks collection scheduled/collected. */
  Date_Collection_Scheduled: string | null;
  Date_Collected: string | null;
  Date_Delivered: string | null;
  /**
   * Institution App Polish module — Admin-set estimates, informational only
   * (never gate the institution's own status transitions). The Admin may
   * consider distance, transport, institution capacity, etc. when setting
   * these; this schema doesn't model those factors, just the resulting dates.
   * Both donor and institution get notified if Admin changes either after
   * it's been set once.
   */
  Expected_Collection_Date: string | null;
  Expected_Delivery_Date: string | null;
  /**
   * Phase 3A Module 1 — a permanent snapshot of the donor's Active_Country_ID at
   * the moment this donation was created. Deliberately NOT derived live from
   * Donor_ID -> Users.Active_Country_ID: a donor's Active Country can change
   * later (e.g. after traveling), and a donation must never silently "move" to
   * another country in reports just because the donor's current setting changed.
   */
  Country_ID: string;
  /**
   * Institution UX module — simple donor-entered free text (e.g. "Luanda").
   * Not a Geo_Regions Region_ID: no Province/Municipality-level data exists
   * yet for any country (Module 1), so a real geographic hierarchy would be
   * pure speculation. Free text gets the donation card 90% of the value
   * ("where is this?") without inventing a geocoding system or a data-entry
   * project that has no rows to populate it with today.
   */
  City: string | null;
  /**
   * RC1 pickup-location fix (2026-08-07) — free text the donor enters
   * alongside the GPS pin (street/building/unit, landmarks, gate codes,
   * etc.), or the address they typed to override the pin entirely. Unlike
   * the geocoding-only address input this replaces, this text is actually
   * stored and shown to the claiming institution — Location (lat/lng) alone
   * left institutions with a map pin and no way to identify the exact
   * pickup spot or contact the donor if they couldn't find it.
   */
  Address: string | null;
  /**
   * RC1 individual-vs-corporate attribution — set only when the donor chose
   * "Corporate Donation" at submission time, always their own linked
   * Corporate_Account_ID (never arbitrary). Null means this specific donation
   * is personal, regardless of whether the donor is linked to a company —
   * the donor-company link itself never changes based on this field.
   */
  Corporate_Account_ID: string | null;
  /**
   * RC1 RECEBER — Admin quality gate. Blank on rows written before this field
   * existed; read as 'Approved' at that point (rowToDonation) so every
   * already-in-flight donation keeps working exactly as it did before this
   * shipped. New donations start 'Pending_Review' and need explicit Admin
   * action before they're visible to any recipient channel.
   */
  Approval_Status: DonationApprovalStatus;
  Approval_Rejection_Reason: string | null;
  /**
   * RC1 RECEBER — set only for Recipient_Category === 'People' donations.
   * Non-null + within 24h of Reserved_At means reserved; anything else is
   * treated as available (lazy expiry, no background job).
   */
  Reserved_By_User_ID: string | null;
  Reserved_At: string | null;
  /** RC1 RECEBER — set when the individual recipient self-confirms pickup (Status becomes 'Delivered' at the same time). */
  Individual_Delivered_At: string | null;
}

/**
 * Institution-facing donation view (Institution UX module) — the same
 * Donation plus a resolved, privacy-aware donor identity. Only ever returned
 * from institution-facing endpoints (available/claimed-by-me), never stored:
 * Donor_Display_Name/Logo are derived fresh from Users/Corporate_Accounts,
 * respecting Users.Show_Name_To_Institutions for individual donors and always
 * showing the company name/logo for Corporate donors (institutional identity,
 * not personal, so not gated by that flag).
 *
 * RC1 pickup-location fix (2026-08-07) — Donor_Phone is resolved the same
 * way and gated by the same flag as Donor_Display_Name: an institution that
 * can't find the pickup spot from Address/Location needs a way to actually
 * reach the donor, but a donor who opted out of showing their name has
 * opted out of personal identification generally, phone included.
 */
export interface InstitutionDonationView extends Donation {
  Donor_Display_Name: string | null;
  Donor_Display_Logo: string | null;
  Donor_Phone: string | null;
}

/**
 * Admin Web App — same as InstitutionDonationView plus the claiming
 * institution's identity, so Admin can tell who's handling each donation
 * when setting Expected_Collection_Date / Expected_Delivery_Date. Only ever
 * returned from admin-facing endpoints.
 */
export interface AdminDonationView extends InstitutionDonationView {
  Claimed_By_Institution_Name: string | null;
  Claimed_By_Institution_Logo: string | null;
  /**
   * Bug fix, 2026-08-08 — whether a Success Story row exists at all for this
   * donation, regardless of status. Gates the "Enviar para a Feed"/"Carregar
   * do PC" actions (the API's own duplicate check blocks a second story
   * either way), but on its own it is NOT the same as "already published" —
   * see Success_Story_Status for that.
   */
  Has_Success_Story: boolean;
  /** Null when Has_Success_Story is false. 'Pending' means an institution submitted one and it's awaiting Admin's separate moderation approval — it is NOT yet visible to any donor. */
  Success_Story_Status: SuccessStoryStatus | null;
  /** RC1 RECEBER — null unless Recipient_Category === 'People'; see enums/individual-donation-state.ts. */
  Individual_State: IndividualDonationState | null;
}

/**
 * RC1 RECEBER — GET /donations/receber-status. What ReceberScreen checks
 * before ever showing the swipe stack: an active reservation resumes the
 * pickup step, a cooldown (since the caller's last confirmed receipt)
 * blocks new reservations, otherwise they're free to browse.
 */
export interface ReceberEligibility {
  eligible: boolean;
  reason: 'active_reservation' | 'cooldown' | null;
  activeReservation: Donation | null;
  /** ISO timestamp, set only when reason === 'cooldown'. */
  nextEligibleAt: string | null;
}
