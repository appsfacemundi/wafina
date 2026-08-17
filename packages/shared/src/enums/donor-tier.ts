/**
 * Donor loyalty milestones (2026-08-17) — never stored as a raw value on any
 * row; the Users sheet only ever stores the highest *threshold number*
 * already emailed for (see User.Highest_Milestone_Notified). Tier name is a
 * presentational label derived from that number via DONOR_TIER_THRESHOLDS in
 * lib/donor-tier.ts — same "computed, not stored" precedent as
 * IndividualDonationState.
 */
export const DONOR_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
export type DonorTier = (typeof DONOR_TIERS)[number];
