import type { Role } from '../enums/role';
import type { DonorSubtype } from '../enums/donor-subtype';
import type { SwitchPreference } from '../enums/switch-preference';
import type { UserStatus } from '../enums/user-status';

export interface User {
  User_ID: string;
  Name: string;
  Phone: string;
  Role: Role;
  /** Admin parity Phase A — a suspended account is rejected at requireAuth, not deleted. */
  Status: UserStatus;
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
  /**
   * Institution UX module (2026-07-30) — "Donor Name (if donor allows)" on
   * donation cards. Defaults FALSE (opt-in, not opt-out) — the safer default
   * for a personal-privacy-affecting flag. Irrelevant for Corporate donors:
   * their donations always show the company name/logo instead (institutional
   * identity, not personal), never gated by this flag.
   */
  Show_Name_To_Institutions: boolean;
  /**
   * RC1 RECEBER — permanent recipient identifier, e.g. "WF-PT-000184".
   * Assigned once, on first profile completion, only for Role === 'Donor'
   * (the only role eligible for the individual RECEBER flow). Null for every
   * other role and for Donors who haven't completed their profile yet.
   */
  Wafina_ID: string | null;
  /**
   * Donor loyalty milestones (2026-08-17) — the highest tier *threshold
   * number* (5/10/25/50, see DONOR_TIER_THRESHOLDS) already emailed for,
   * never the tier name itself — a threshold change later doesn't strand
   * this value. Null means no milestone email sent yet (including every
   * Institution/Admin/Animal_Shelter row, where this never applies). Doubles
   * as the donor's current tier for display (Admin's Users list): the
   * highest tier whose threshold is <= this number.
   */
  Highest_Milestone_Notified: number | null;
}
