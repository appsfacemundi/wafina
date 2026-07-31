import type { AdminDashboardStats } from '@wafina/shared';
import { listPendingChangeRequests } from './change-requests';
import { listInFlightDonationsForAdmin } from './donations';
import { listPendingInstitutions, listVerifiedInstitutions } from './institutions';
import { listPendingSuccessStories } from './success-stories';

/** Admin dashboard overview — counts across every moderation queue, so Admin has a landing page instead of jumping straight into one list. */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [pendingInstitutions, verifiedInstitutions, inFlightDonations, pendingSuccessStories, pendingChangeRequests] =
    await Promise.all([
      listPendingInstitutions(),
      listVerifiedInstitutions(),
      listInFlightDonationsForAdmin(),
      listPendingSuccessStories(),
      listPendingChangeRequests(),
    ]);

  return {
    pendingInstitutions: pendingInstitutions.length,
    verifiedInstitutions: verifiedInstitutions.length,
    inFlightDonations: inFlightDonations.length,
    pendingSuccessStories: pendingSuccessStories.length,
    pendingChangeRequests: pendingChangeRequests.length,
  };
}
