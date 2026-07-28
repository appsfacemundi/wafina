export const ROLES = ['Donor', 'Institution', 'Admin'] as const;
export type Role = (typeof ROLES)[number];
