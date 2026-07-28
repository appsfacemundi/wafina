export const DONOR_SUBTYPES = ['Individual', 'Corporate'] as const;
export type DonorSubtype = (typeof DONOR_SUBTYPES)[number];
