/**
 * Tab names as verified against the live sheet (MASTER_SPECIFICATION.md, Section 6) —
 * Corporate_Accounts and Change_Requests are new tabs that don't exist there yet.
 */
export const SHEET_TABS = {
  users: 'Users',
  donations: 'Donations',
  institutions: 'Institutions',
  disputes: 'Disputes',
  corporateAccounts: 'Corporate_Accounts',
  changeRequests: 'Change_Requests',
  notifications: 'Notifications',
  /** Phase 3A Module 1 — the permanent geographic model. See packages/shared/src/types/geo-region.ts. */
  geoRegions: 'Geo_Regions',
} as const;
