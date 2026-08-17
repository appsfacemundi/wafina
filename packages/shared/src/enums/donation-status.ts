/**
 * Institution App Polish module (2026-07-31) — Collection_Scheduled and
 * Collected are new, inserted between Claimed and Delivered to make the
 * physical journey visible (the institution progresses through each as they
 * schedule, then physically collect, then deliver). Existing values/meaning
 * unchanged; this is a pure insertion, not a rename.
 *
 * Admin donation edit/cancel (V2, 2026-08-17) — Cancelled is a second pure
 * insertion, a terminal state set only by Admin (adminCancelDonation) when a
 * donation needs to be voided (donor withdrawal, data-entry mistake). Never
 * reached via the normal claim->deliver journey.
 */
export const DONATION_STATUSES = [
  'Pending',
  'Claimed',
  'Collection_Scheduled',
  'Collected',
  'Delivered',
  'Cancelled',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];
