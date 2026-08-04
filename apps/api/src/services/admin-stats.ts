import type { AdminDashboardStats } from '@wafina/shared';
import { listPendingChangeRequests } from './change-requests';
import { countPendingDonations, listInFlightDonationsForAdmin } from './donations';
import { listAllOpenDisputes } from './disputes';
import { listPendingInstitutions, listVerifiedInstitutions } from './institutions';
import { listPendingSuccessStories } from './success-stories';

/** Admin dashboard overview — counts across every moderation queue, so Admin has a landing page instead of jumping straight into one list. */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    pendingInstitutions,
    verifiedInstitutions,
    pendingDonations,
    inFlightDonations,
    pendingSuccessStories,
    pendingChangeRequests,
    openDisputes,
  ] = await Promise.all([
    listPendingInstitutions(),
    listVerifiedInstitutions(),
    countPendingDonations(),
    listInFlightDonationsForAdmin(),
    listPendingSuccessStories(),
    listPendingChangeRequests(),
    listAllOpenDisputes(),
  ]);

  return {
    pendingInstitutions: pendingInstitutions.length,
    verifiedInstitutions: verifiedInstitutions.length,
    pendingDonations,
    inFlightDonations: inFlightDonations.length,
    pendingSuccessStories: pendingSuccessStories.length,
    pendingChangeRequests: pendingChangeRequests.length,
    openDisputes: openDisputes.length,
  };
}
