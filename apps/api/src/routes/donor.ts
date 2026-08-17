import { Router } from 'express';
import { getFirebaseAuth } from '../config/firebase';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { getCorporateAccountById, getCorporateAccountStats } from '../services/corporate-accounts';
import { redeemInvitationCode } from '../services/invitation-codes';
import { completeProfile, deleteDonorAccount, findUserById, linkCorporateAccount } from '../services/users';
import { ValidationError } from '../services/validation-error';

export const donorRouter = Router();

/** Settings screen — Name/Phone/Home_Country_ID aren't part of the session, so this backs the edit form. */
donorRouter.get(
  '/donor/profile',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const row = await findUserById(req.user!.userId);
    if (!row) throw new ValidationError('Utilizador não encontrado');
    res.json({ Name: row.Name, Phone: row.Phone, Home_Country_ID: row.Home_Country_ID });
  }),
);

/** Spec 13.1 — fills in Name/Phone/Home_Country_ID right after a brand-new sign-in (also reused by Settings edits). */
donorRouter.patch(
  '/donor/profile',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const profile = await completeProfile(req.user!.userId, req.body);
    res.json(profile);
  }),
);

/**
 * Spec 13.2 — links an existing Donor to a company account via an
 * Admin-generated invitation code (Admin Web App Parity Phase B — codes are
 * their own entity now, with expiration/usage limits, rather than the
 * Corporate_Account_ID itself doubling as the code).
 */
donorRouter.post(
  '/donor/corporate/join',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.corporateAccountId) {
      throw new ValidationError('Já está associado a uma conta empresarial');
    }

    const inviteCode = req.body?.inviteCode as string | undefined;
    if (!inviteCode) throw new ValidationError('O código de convite é obrigatório');

    // redeemInvitationCode already verifies the company exists and isn't suspended before returning.
    const corporateAccountId = await redeemInvitationCode(inviteCode, user.email);
    const account = await getCorporateAccountById(corporateAccountId);

    await linkCorporateAccount(user.userId, corporateAccountId);
    res.json(account);
  }),
);

/**
 * RC1 individual-vs-corporate donations — the donation form needs the linked
 * company's name to label the "Corporate Donation (X)" choice. Returns null
 * when the donor isn't linked to any company (nothing to choose from).
 *
 * Corporate dashboard (V2, 2026-08-17) — also carries `stats`, the same
 * aggregate counts Admin's Companies page shows (getCorporateAccountStats),
 * so the Settings screen's existing single fetch doubles as the dashboard's
 * data source. Additive to the response shape — existing consumers reading
 * only Company_Name/Logo/etc. are unaffected.
 */
donorRouter.get(
  '/donor/corporate-account',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const { corporateAccountId } = req.user!;
    if (!corporateAccountId) {
      res.json(null);
      return;
    }
    const [account, stats] = await Promise.all([
      getCorporateAccountById(corporateAccountId),
      getCorporateAccountStats(corporateAccountId),
    ]);
    res.json(account ? { ...account, stats } : null);
  }),
);

/**
 * RC1 self-service account deletion (Google Play/Apple account-deletion policy) — Donor accounts
 * only, see COMPLIANCE_INFORMATION.md for why Institution accounts stay support-mediated. Sheets
 * row is anonymized first (immediate lockout via requireAuth even if the Firebase step below were
 * to fail) then the Firebase Auth user itself is deleted, revoking the credential entirely.
 */
donorRouter.delete(
  '/donor/account',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    await deleteDonorAccount(req.user!.userId);
    await getFirebaseAuth().deleteUser(req.user!.uid);
    res.status(204).send();
  }),
);
