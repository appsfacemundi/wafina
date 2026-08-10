export const ROLES = ['Donor', 'Institution', 'Admin', 'Animal_Shelter'] as const;
export type Role = (typeof ROLES)[number];
