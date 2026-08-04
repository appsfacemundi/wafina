/** Admin Web App dashboard overview — mirrors the stat-tile pattern already used on the Donor/Institution Home screens. */
export interface AdminDashboardStats {
  pendingInstitutions: number;
  verifiedInstitutions: number;
  /** Submitted but not yet claimed by any institution — previously invisible anywhere on Admin's dashboard. */
  pendingDonations: number;
  inFlightDonations: number;
  pendingSuccessStories: number;
  pendingChangeRequests: number;
  openDisputes: number;
}
