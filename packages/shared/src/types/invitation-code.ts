/**
 * Admin Web App Parity Phase B (2026-07-31) — a real invitation-code entity,
 * replacing the earlier stand-in that treated a company's own
 * Corporate_Account_ID as its invite code (no expiration, no usage limit,
 * no way to have more than one code per company). A code is single-use when
 * Max_Uses is 1, multi-use for any higher number.
 */
export interface InvitationCode {
  Code: string;
  Corporate_Account_ID: string;
  Max_Uses: number;
  Uses_Count: number;
  /** Null means it never expires. */
  Expires_At: string | null;
  Date_Created: string;
  /** Admin can deactivate a code early without waiting for it to hit Max_Uses or Expires_At. */
  Active: boolean;
  /**
   * Corporate secure invitations (V2, 2026-08-17) — set only when Admin sent
   * this code directly to one person's email rather than generating an
   * anonymous shareable code. When set, redemption is locked to this exact
   * address (see redeemInvitationCode). Null for every code created via the
   * original generate-and-share flow.
   */
  Invited_Email: string | null;
}
