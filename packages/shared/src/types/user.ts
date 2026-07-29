import type { Role } from '../enums/role';
import type { DonorSubtype } from '../enums/donor-subtype';
import type { SwitchPreference } from '../enums/switch-preference';

export interface User {
  User_ID: string;
  Name: string;
  Phone: string;
  Role: Role;
  /** Only set when Role === 'Donor'. */
  Donor_Subtype: DonorSubtype | null;
  /** Only set when Donor_Subtype === 'Corporate'. */
  Corporate_Account_ID: string | null;
  Verified: boolean;
  Email: string;
  Date_Joined: string;
  /**
   * Phase 3A Module 1 — the Country/Home/Active/Current-GPS model.
   * Home_Country_ID: set at registration, rarely changes ("where this person is from").
   * Active_Country_ID: defaults to Home_Country_ID, drives which institutions/donations/
   *   reports/maps are visible. Only changes when the user explicitly says so — GPS never
   *   sets this directly (see Switch_Preference and the /users/me/active-country endpoint).
   * "Current GPS Country" is deliberately NOT a field here — it's a live signal computed
   *   client-side each session (packages/shared/src/lib/geo-detect.ts), never persisted,
   *   since storing it would just be a stale snapshot rather than a fact about the account.
   */
  Home_Country_ID: string;
  Active_Country_ID: string;
  /** Governs whether the app offers the switch-country prompt at all. Never auto-switches. */
  Switch_Preference: SwitchPreference;
}
