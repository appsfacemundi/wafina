import { Router } from 'express';
import { REGISTRABLE_ROLES, type RegistrableRole } from '@wafina/shared';
import { ConfigurationError } from '../config/configuration-error';
import { getFirebaseAuth } from '../config/firebase';
import { requireAuth } from '../middleware/auth';
import { createUser, findUserByEmail, toAuthenticatedUser } from '../services/users';

export const authRouter = Router();

/**
 * Called right after the client signs in/up with Firebase. Resolves the
 * matching Users row, or bootstraps one for a brand-new identity — `role`
 * is only honored in that bootstrap case; an existing row's Role always wins,
 * so a client can never escalate an existing account by re-sending a role.
 */
authRouter.post('/auth/session', async (req, res) => {
  const token = req.body?.idToken as string | undefined;
  const requestedRole = req.body?.role as RegistrableRole | undefined;

  if (!token) {
    res.status(400).json({ error: 'idToken is required' });
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
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  if (!email) {
    res.status(401).json({ error: 'Token has no associated email' });
    return;
  }

  let userRow = await findUserByEmail(email);

  if (!userRow) {
    if (!requestedRole || !REGISTRABLE_ROLES.includes(requestedRole)) {
      res.status(400).json({ error: `role must be one of: ${REGISTRABLE_ROLES.join(', ')}` });
      return;
    }
    userRow = await createUser(email, requestedRole);
  }

  res.json(toAuthenticatedUser(uid, userRow));
});

authRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});
