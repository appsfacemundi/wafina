import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { listActivePartners } from '../services/partners';

export const partnersRouter = Router();

/** "Os Nossos Parceiros" section on the Donor Home — any authenticated role, Active partners only. */
partnersRouter.get(
  '/partners',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await listActivePartners());
  }),
);
