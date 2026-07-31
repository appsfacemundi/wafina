import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import { createChangeRequest } from '../services/change-requests';
import { getInstitutionByUserId } from '../services/institutions';
import { ValidationError } from '../services/validation-error';

async function requireOwnInstitutionId(userId: string): Promise<string> {
  const institution = await getInstitutionByUserId(userId);
  if (!institution) throw new ValidationError('Esta conta não tem um perfil de Instituição');
  return institution.Institution_ID;
}

export const changeRequestsRouter = Router();

/** "Request Change" (spec 9.2, 11.5) — the only way a verified institution can get a locked field changed. */
changeRequestsRouter.post(
  '/change-requests',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    const request = await createChangeRequest(
      institutionId,
      req.user!.userId,
      req.body.Field_Requested,
      req.body.Reason,
    );
    res.status(201).json(request);
  }),
);
