import type { DonationStatus } from '../enums/donation-status';
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
}

/**
 * Institution-facing donation view (Institution UX module) — the same
 * Donation plus a resolved, privacy-aware donor identity. Only ever returned
 * from institution-facing endpoints (available/claimed-by-me), never stored:
 * Donor_Display_Name/Logo are derived fresh from Users/Corporate_Accounts,
 * respecting Users.Show_Name_To_Institutions for individual donors and always
 * showing the company name/logo for Corporate donors (institutional identity,
 * not personal, so not gated by that flag).
 */
export interface InstitutionDonationView extends Donation {
  Donor_Display_Name: string | null;
  Donor_Display_Logo: string | null;
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
}
