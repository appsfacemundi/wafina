import { Router } from 'express';
import { REGISTRABLE_ROLES, type RegistrableRole } from '@wafina/shared';
import { ConfigurationError } from '../config/configuration-error';
import { getFirebaseAuth } from '../config/firebase';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { createUser, findUserByEmail, toAuthenticatedUser } from '../services/users';

export const authRouter = Router();

/**
 * Called right after the client signs in/up with Firebase. Resolves the
 * matching Users row, or bootstraps one for a brand-new identity — `role`
 * is only honored in that bootstrap case; an existing row's Role always wins,
 * so a client can never escalate an existing account by re-sending a role.
 *
 * Wrapped in asyncHandler (2026-07-30 fix): this is the actual login
 * endpoint — before this fix it was an unwrapped async handler, so any
 * rejection here (e.g. a Sheets API error) crashed the whole process instead
 * of returning a clean error. See requireAuth's doc comment for the full
 * incident this was the root cause of.
 */
authRouter.post(
  '/auth/session',
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = req.body?.idToken as string | undefined;
    const requestedRole = req.body?.role as RegistrableRole | undefined;

    if (!token) {
      res.status(400).json({ error: 'idToken é obrigatório' });
      return;
    }

    let email: string | undefined;
    let uid: string;
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email;
    } catch (err) {
      if (err instanceof ConfigurationError) {
        res.status(503).json({ error: err.message });
        return;
      }
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    if (!email) {
      res.status(401).json({ error: 'O token não tem um e-mail associado' });
      return;
    }

    let userRow = await findUserByEmail(email);

    if (!userRow) {
      if (!requestedRole || !REGISTRABLE_ROLES.includes(requestedRole)) {
        res.status(400).json({ error: `role deve ser um dos seguintes: ${REGISTRABLE_ROLES.join(', ')}` });
        return;
      }
      userRow = await createUser(email, requestedRole);
    }

    // Admin parity Phase A — without this, a suspended user still got a valid
    // session back here (this endpoint doesn't go through requireAuth) and
    // landed on a half-broken app shell, with only the *next* data call
    // failing. Blocking it here instead gives a clear message right at login.
    if (userRow.Status === 'Suspended') {
      res.status(403).json({ error: 'Esta conta foi suspensa' });
      return;
    }

    res.json(toAuthenticatedUser(uid, userRow));
  }),
);

authRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});
