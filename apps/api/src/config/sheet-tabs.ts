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
  /** Phase 3A Module 2 — MVP. See packages/shared/src/types/success-story.ts. */
  successStories: 'Success_Stories',
  /** Admin Web App Parity Phase B — replaces treating Corporate_Account_ID itself as the invite code. */
  invitationCodes: 'Invitation_Codes',
  /** Launch-critical, 2026-08-08 — "Our Partners" section. See packages/shared/src/types/partner.ts. */
  partners: 'Partners',
  /**
   * RECEBER collection-point flow, 2026-08-10 — one row per country, the
   * physical Wafina-run location where People-category recipients collect a
   * reserved donation. Country_ID-keyed (never a country name/code
   * conditional), matching the same pattern the rest of the country-routing
   * work already established.
   */
  collectionPoints: 'Collection_Points',
} as const;
