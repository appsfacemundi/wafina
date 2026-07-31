import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { getAdminDashboardStats } from '../services/admin-stats';
import {
  approveChangeRequest,
  listPendingChangeRequests,
  rejectChangeRequest,
} from '../services/change-requests';
import { listInFlightDonationsForAdmin } from '../services/donations';
import { listPendingInstitutions, rejectInstitution, verifyInstitution } from '../services/institutions';
import { approveSuccessStory, listPendingSuccessStories, rejectSuccessStory } from '../services/success-stories';

/**
 * Admin Web App foundation (Permanent Rules Update, 2026-07-30) — the first
 * REST surface for Admin actions, replacing what AppSheet did for this one
 * workflow. Deliberately narrow: institution verification only, for now.
 * Every route here is Admin-only.
 */
export const adminRouter = Router();

/** Dashboard overview — mirrors the stat-tile pattern on the Donor/Institution Home screens. */
adminRouter.get(
  '/admin/stats',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await getAdminDashboardStats());
  }),
);

adminRouter.get(
  '/admin/institutions/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingInstitutions());
  }),
);

adminRouter.post(
  '/admin/institutions/:id/verify',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await verifyInstitution(req.params.id));
  }),
);

adminRouter.post(
  '/admin/institutions/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectInstitution(req.params.id, req.body?.reason));
  }),
);

/**
 * Institution App Polish module — donations Admin can set logistics
 * estimates for. Also usable in /donations/:id/expected-dates (defined in
 * donations.ts route) to actually write the estimate.
 */
adminRouter.get(
  '/admin/donations',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listInFlightDonationsForAdmin());
  }),
);

/** Success Story moderation module — nothing an institution publishes is visible until Admin acts on it. */
adminRouter.get(
  '/admin/success-stories/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingSuccessStories());
  }),
);

adminRouter.post(
  '/admin/success-stories/:id/approve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await approveSuccessStory(req.params.id));
  }),
);

adminRouter.post(
  '/admin/success-stories/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectSuccessStory(req.params.id, req.body?.reason));
  }),
);

/**
 * Change Request moderation — the missing piece since AppSheet was retired
 * from the architecture (2026-07-30): institutions could already submit a
 * request to change a locked field, but nothing in this codebase let Admin
 * see or act on it until now.
 */
adminRouter.get(
  '/admin/change-requests/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingChangeRequests());
  }),
);

adminRouter.post(
  '/admin/change-requests/:id/approve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await approveChangeRequest(req.params.id, req.body?.value));
  }),
);

adminRouter.post(
  '/admin/change-requests/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectChangeRequest(req.params.id, req.body?.reason));
  }),
);
