/**
 * Launch-critical, 2026-08-08 — the "Our Partners" trust-building section on
 * the Donor Home (web + mobile). Deliberately minimal, same MVP shape as
 * SuccessStory: enough for a logo grid plus a click-through profile, nothing
 * a future richer partner-portal couldn't be layered on top of later.
 */
export interface Partner {
  Partner_ID: string;
  Name: string;
  /** Google Drive URL, same upload path as donation photos and success-story images. */
  Logo: string;
  /** Shown on the click-through profile. */
  Description: string;
  /** Optional — "Visit website" on the profile. Null when a partner has none. */
  Website: string | null;
  /** Lets Admin pause a partner without losing its profile data, same pattern as GeoRegion.Active. */
  Active: boolean;
  /** Admin-controlled position in the public grid — lower shows first. */
  Display_Order: number;
  Date_Added: string;
}
