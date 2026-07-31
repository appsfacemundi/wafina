import { Router } from 'express';
import { REGISTRABLE_ROLES, type RegistrableRole } from '@wafina/shared';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { getAdminDashboardStats } from '../services/admin-stats';
import {
  approveChangeRequest,
  listPendingChangeRequests,
  rejectChangeRequest,
} from '../services/change-requests';
import { listInFlightDonationsForAdmin } from '../services/donations';
import { listAllOpenDisputes, resolveDispute } from '../services/disputes';
import { createCountry, listAllCountries, setCountryActive } from '../services/geo-regions';
import { listPendingInstitutions, rejectInstitution, verifyInstitution } from '../services/institutions';
import { approveSuccessStory, listPendingSuccessStories, rejectSuccessStory } from '../services/success-stories';
import { listAllUsers, reactivateUser, setUserRole, suspendUser } from '../services/users';
import { ValidationError } from '../services/validation-error';

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

/**
 * Users management (Admin Web App Parity module, 2026-07-31) — Admin
 * previously had no way to view, suspend, or correct a mis-registered
 * account's role. Role changes are deliberately restricted to Donor <->
 * Institution in the service layer — never a path to grant Admin access.
 */
adminRouter.get(
  '/admin/users',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllUsers());
  }),
);

adminRouter.post(
  '/admin/users/:id/suspend',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await suspendUser(req.params.id));
  }),
);

adminRouter.post(
  '/admin/users/:id/reactivate',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await reactivateUser(req.params.id));
  }),
);

adminRouter.post(
  '/admin/users/:id/role',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const role = req.body?.role as RegistrableRole;
    if (!REGISTRABLE_ROLES.includes(role)) {
      throw new ValidationError('Role must be Donor or Institution');
    }
    res.json(await setUserRole(req.params.id, role));
  }),
);

/**
 * Countries management (Admin Web App Parity module, 2026-07-31) — Geo_Regions
 * already supported this at the type level ("Lets Admin launch a country by
 * flipping one flag") but no write route existed until now.
 */
adminRouter.get(
  '/admin/countries',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllCountries());
  }),
);

adminRouter.patch(
  '/admin/countries/:id',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await setCountryActive(req.params.id, Boolean(req.body?.active)));
  }),
);

adminRouter.post(
  '/admin/countries',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await createCountry(req.body?.name, req.body?.isoCode));
  }),
);

/**
 * Disputes resolution (Admin Web App Parity module, 2026-07-31) — previously
 * "exclusively in AppSheet"; stale now that AppSheet is retired.
 */
adminRouter.get(
  '/admin/disputes/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllOpenDisputes());
  }),
);

adminRouter.post(
  '/admin/disputes/:id/resolve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await resolveDispute(req.params.id, req.body?.resolutionNotes));
  }),
);
