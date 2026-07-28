import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser, Role } from '@wafina/shared';
import { ConfigurationError } from '../config/configuration-error';
import { getFirebaseAuth } from '../config/firebase';
import { getInstitutionByUserId } from '../services/institutions';
import { findUserByEmail, toAuthenticatedUser } from '../services/users';
import { asyncHandler } from './async-handler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the Firebase ID token on every request and re-resolves Role/Verified
 * from the Users sheet — the client's own claims are never trusted (spec 14.2).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  let uid: string;
  let email: string | undefined;
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

  const userRow = await findUserByEmail(email);
  if (!userRow) {
    res.status(404).json({ error: 'No Wafina account for this identity yet' });
    return;
  }

  req.user = toAuthenticatedUser(uid, userRow);

  next();
}

/** Section 4 permission gate — use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

/**
 * Spec 11.2 — Institutions are fully blocked from donation actions until
 * Admin verifies them. Use after requireAuth on action endpoints (browse,
 * claim, deliver, dispute) — never on the registration/status endpoints
 * themselves, since those are exactly what an unverified institution needs.
 *
 * Checks Institutions.Verified directly rather than the session's `verified`
 * flag (which mirrors Users.Verified): Admin approves institutions by editing
 * the Institutions row in AppSheet, and there's no automation keeping a
 * Users.Verified copy in sync. Institutions.Verified is the single source of
 * truth here — checking it directly avoids depending on that sync existing.
 */
export const requireVerified = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const institution = req.user ? await getInstitutionByUserId(req.user.userId) : null;
  if (!institution?.Verified) {
    res.status(403).json({ error: 'Account is not yet verified' });
    return;
  }
  next();
});
