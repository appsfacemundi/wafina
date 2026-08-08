/** Admin Web App dashboard overview — mirrors the stat-tile pattern already used on the Donor/Institution Home screens. */
export interface AdminDashboardStats {
  pendingInstitutions: number;
  verifiedInstitutions: number;
  /** Submitted but not yet claimed by any institution — previously invisible anywhere on Admin's dashboard. */
  pendingDonations: number;
  /** Same count, keyed by Country_ID — lets the dashboard show where pending donations actually are, not just how many. */
  pendingDonationsByCountry: Record<string, number>;
  inFlightDonations: number;
  pendingSuccessStories: number;
  pendingChangeRequests: number;
  openDisputes: number;
  activePartners: number;
}
