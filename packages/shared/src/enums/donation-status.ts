export const DONATION_STATUSES = ['Pending', 'Claimed', 'Delivered'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];
