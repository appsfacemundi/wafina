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
 *
 * Wrapped in asyncHandler: this function is mounted directly as middleware on
 * nearly every route, unlike route handlers which already went through
 * asyncHandler individually. Before this fix, any rejection here (e.g. a
 * transient Google Sheets API error) was an unhandled promise rejection that
 * crashed the entire Node process — confirmed as the root cause of a real
 * incident (2026-07-30): a Sheets API quota error (429, 60 reads/min/user)
 * during heavy testing crashed the API mid-session, which looked like "login
 * suddenly stopped working" from the client, since every request — including
 * the login call itself — failed with connection-refused until the process
 * was manually restarted. tsx watch does not restart on runtime crashes, only
 * file changes, so the outage persisted silently.
 */
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação em falta' });
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
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  if (!email) {
    res.status(401).json({ error: 'O token não tem um e-mail associado' });
    return;
  }

  const userRow = await findUserByEmail(email);
  if (!userRow) {
    res.status(404).json({ error: 'Ainda não existe uma conta Wafina para esta identidade' });
    return;
  }

  // Admin parity Phase A — the row is already fetched fresh on every request, so a suspension
  // (or, since RC1, a self-service deletion) takes effect immediately with no Firebase token
  // revocation. Checking !== 'Active' rather than === 'Suspended' means a deleted account is
  // locked out right away too, even if its still-unexpired Firebase ID token would otherwise
  // keep passing verifyIdToken for up to an hour.
  if (userRow.Status !== 'Active') {
    res.status(403).json({ error: 'Esta conta foi suspensa' });
    return;
  }

  req.user = toAuthenticatedUser(uid, userRow);

  next();
});

const ROLE_LABEL: Record<Role, string> = { Donor: 'Doador', Institution: 'Instituição', Admin: 'Admin' };

/**
 * Section 4 permission gate — use after requireAuth.
 *
 * Real-device finding, 2026-08-04: the same Wafina account (Firebase email) works
 * across every app, but Role is fixed on the account's first-ever sign-up and
 * never changes automatically. Someone who signs into the Institution app with an
 * email that already has a Donor account hits this check on submitting their
 * institution profile — previously a generic "Acesso não autorizado" with no
 * indication of why. Naming the actual mismatch here means the message is
 * self-explanatory wherever this gate fires, not just at that one call site.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(403).json({ error: 'Acesso não autorizado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Esta conta está registada como ${ROLE_LABEL[req.user.role]}, não é possível continuar aqui.`,
      });
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
 * flag (which mirrors Users.Verified): Admin approves institutions via
 * verifyInstitution() (services/institutions.ts), which sets
 * Institutions.Verified but has no automation keeping a Users.Verified copy
 * in sync. Institutions.Verified is the single source of truth here —
 * checking it directly avoids depending on that sync existing.
 */
export const requireVerified = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const institution = req.user ? await getInstitutionByUserId(req.user.userId) : null;
  if (!institution?.Verified) {
    res.status(403).json({ error: 'A conta ainda não foi verificada' });
    return;
  }
  next();
});
