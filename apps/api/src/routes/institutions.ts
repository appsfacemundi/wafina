import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { createInstitution, getInstitutionByUserId, listVerifiedInstitutions } from '../services/institutions';

export const institutionsRouter = Router();

/**
 * Registration (spec 13.3) — deliberately NOT gated by requireVerified, since
 * an unverified institution submitting its profile is exactly what this is for.
 */
institutionsRouter.post(
  '/institutions',
  requireAuth,
  requireRole('Institution'),
  asyncHandler(async (req, res) => {
    const institution = await createInstitution(req.user!.userId, req.body);
    res.status(201).json(institution);
  }),
);

/** Verification Status screen (spec 9.2) reads this — also not gated by requireVerified. */
institutionsRouter.get(
  '/institutions/me',
  requireAuth,
  requireRole('Institution'),
  asyncHandler(async (req, res) => {
    const institution = await getInstitutionByUserId(req.user!.userId);
    res.json(institution);
  }),
);

/**
 * Donor-facing browse (spec 3.2/4.1) — read-only, and only a public subset:
 * Rejection_Reason and Locked_Fields are institution/Admin-internal, not
 * something a donor browsing institutions should see.
 */
institutionsRouter.get(
  '/institutions',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (_req, res) => {
    const institutions = await listVerifiedInstitutions();
    res.json(
      institutions.map((institution) => ({
        Institution_ID: institution.Institution_ID,
        Name: institution.Name,
        Logo: institution.Logo,
        Type: institution.Type,
        Location: institution.Location,
        Needs_List: institution.Needs_List,
        Total_Items_Received: institution.Total_Items_Received,
      })),
    );
  }),
);
