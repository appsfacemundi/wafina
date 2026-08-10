/**
 * RC1 RECEBER — Admin quality gate every donation passes through before it
 * becomes visible to any recipient channel (Institution, Animal Shelter, or
 * individual RECEBER). Blank on donations created before this gate existed —
 * treated as 'Approved' at read time (see rowToDonation) so the existing
 * Institution pipeline never silently loses in-flight donations.
 */
export const DONATION_APPROVAL_STATUSES = ['Pending_Review', 'Approved', 'Rejected'] as const;
export type DonationApprovalStatus = (typeof DONATION_APPROVAL_STATUSES)[number];
