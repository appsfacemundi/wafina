/** Admin Web App dashboard overview — mirrors the stat-tile pattern already used on the Donor/Institution Home screens. */
export interface AdminDashboardStats {
  pendingInstitutions: number;
  verifiedInstitutions: number;
  inFlightDonations: number;
  pendingSuccessStories: number;
  pendingChangeRequests: number;
}
