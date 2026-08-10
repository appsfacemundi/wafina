/**
 * Roles a client may request when bootstrapping a brand-new Users row.
 * Admin is provisioned directly (spec 3.1) and can never be self-registered.
 */
export const REGISTRABLE_ROLES = ['Donor', 'Institution', 'Animal_Shelter'] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];
