import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { listVerifiedInstitutions } from '../services/institutions';

export const institutionsRouter = Router();

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
