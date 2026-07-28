import type { GeoPoint } from './geo-point';

export interface Institution {
  Institution_ID: string;
  /** FK -> Users.User_ID, unique (spec 7.1: 1:1 Users <-> Institutions). */
  User_ID: string;
  Name: string;
  Logo: string | null;
  /**
   * Open/extensible category (spec 2.3.2) — not a closed enum by design.
   * TODO(Module 3): pull the current values from the live Google Sheet /
   * AppSheet Valid_If for the initial controlled list.
   */
  Type: string;
  Location: GeoPoint;
  Needs_List: string | null;
  Verified: boolean;
  Rejection_Reason: string | null;
  /** Calculated field. */
  Total_Items_Received: number;
  /**
   * Field-by-field lock mechanism (spec 4.2.4, 5.3.3).
   * NEW column — does not exist in the reference Sheet yet; added in Module 3.
   * Lists the field names currently locked (all fields lock automatically on verification).
   */
  Locked_Fields: string[];
}
