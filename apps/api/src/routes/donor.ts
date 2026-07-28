import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { findCorporateAccountByInviteCode } from '../services/corporate-accounts';
import { completeProfile, findUserById, linkCorporateAccount } from '../services/users';
import { ValidationError } from '../services/validation-error';

export const donorRouter = Router();

/** Settings screen — Name/Phone/Country aren't part of the session, so this backs the edit form. */
donorRouter.get(
  '/donor/profile',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const row = await findUserById(req.user!.userId);
    if (!row) throw new ValidationError('User not found');
    res.json({ Name: row.Name, Phone: row.Phone, Country: row.Country });
  }),
);

/** Spec 13.1 — fills in Name/Phone/Country right after a brand-new sign-in (also reused by Settings edits). */
donorRouter.patch(
  '/donor/profile',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const profile = await completeProfile(req.user!.userId, req.body);
    res.json(profile);
  }),
);

/** Spec 13.2 — links an existing Donor to a company account via Admin-issued invite code. */
donorRouter.post(
  '/donor/corporate/join',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.corporateAccountId) {
      throw new ValidationError('Already linked to a corporate account');
    }

    const inviteCode = req.body?.inviteCode as string | undefined;
    if (!inviteCode) throw new ValidationError('inviteCode is required');

    const account = await findCorporateAccountByInviteCode(inviteCode);
    if (!account) throw new ValidationError('Invalid invite code');

    await linkCorporateAccount(user.userId, account.Corporate_Account_ID);
    res.json(account);
  }),
);
