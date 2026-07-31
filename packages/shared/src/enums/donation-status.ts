/**
 * Institution App Polish module (2026-07-31) — Collection_Scheduled and
 * Collected are new, inserted between Claimed and Delivered to make the
 * physical journey visible (the institution progresses through each as they
 * schedule, then physically collect, then deliver). Existing values/meaning
 * unchanged; this is a pure insertion, not a rename.
 */
export const DONATION_STATUSES = [
  'Pending',
  'Claimed',
  'Collection_Scheduled',
  'Collected',
  'Delivered',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];
