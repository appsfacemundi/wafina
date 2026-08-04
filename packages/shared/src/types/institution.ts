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
  /**
   * Phase 3A Module 1 — the institution's actual operating country, independent
   * of whoever registered it. Required: verified institutions are only visible
   * to donors whose Active Country matches this.
   */
  Country_ID: string;
  /** Province/Municipality/District, once that depth of data exists for the country. */
  Region_ID: string | null;
  /** Optional radius in km, for future donor/institution matching. Kept simple by design. */
  Service_Radius_Km: number | null;
  /** Optional free-text description of the area served, e.g. "all of Luanda province". */
  Coverage_Area: string | null;
  /**
   * Real-device finding, 2026-08-04: the address typed at registration (when
   * GPS wasn't available) was only ever used to geocode into Location — the
   * text itself was discarded, so there was nothing to show back to the
   * institution or let them edit later. Stored as entered; null when
   * registration used GPS directly (no typed address to store).
   */
  Address: string | null;
}
