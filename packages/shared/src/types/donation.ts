import type { DonationStatus } from '../enums/donation-status';
import type { GeoPoint } from './geo-point';

export interface Donation {
  Donation_ID: string;
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
  Date_Delivered: string | null;
}
