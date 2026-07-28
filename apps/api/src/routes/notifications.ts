import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { listNotificationsByUser, markNotificationRead } from '../services/notifications';

export const notificationsRouter = Router();

/** Inbox (spec 9.1) — any authenticated role, not Donor-only (Institutions get notified too, spec 19). */
notificationsRouter.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listNotificationsByUser(req.user!.userId));
  }),
);

notificationsRouter.patch(
  '/notifications/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await markNotificationRead(req.user!.userId, req.params.id);
    res.json({ ok: true });
  }),
);
