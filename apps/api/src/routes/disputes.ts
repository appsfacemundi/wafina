import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import { createDispute, listDisputesByInstitution } from '../services/disputes';
import { getInstitutionByUserId } from '../services/institutions';
import { ValidationError } from '../services/validation-error';

async function requireOwnInstitutionId(userId: string): Promise<string> {
  const institution = await getInstitutionByUserId(userId);
  if (!institution) throw new ValidationError('Esta conta não tem um perfil de Instituição');
  return institution.Institution_ID;
}

export const disputesRouter = Router();

/** Spec 11.3 — raise a dispute on a donation the institution itself claimed. */
disputesRouter.post(
  '/disputes',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    const dispute = await createDispute(
      institutionId,
      req.user!.userId,
      req.body.Donation_ID,
      req.body.Issue_Description,
    );
    res.status(201).json(dispute);
  }),
);

/** "My Disputes" (spec 9.2). */
disputesRouter.get(
  '/disputes/mine',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    res.json(await listDisputesByInstitution(institutionId));
  }),
);
