import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import {
  assertValidDonationFields,
  claimDonation,
  confirmDelivery,
  createDonation,
  editDonation,
  listAvailableDonations,
  listDonationsByCorporateAccount,
  listDonationsByDonor,
  listDonationsClaimedByInstitution,
  markCollected,
  scheduleCollection,
  setExpectedDates,
} from '../services/donations';
import { getInstitutionByUserId } from '../services/institutions';
import { ValidationError } from '../services/validation-error';
import type { Institution } from '@wafina/shared';

/** Every claim/deliver/browse action is keyed by Institution_ID, not the caller's User_ID. */
async function requireOwnInstitution(userId: string): Promise<Institution> {
  const institution = await getInstitutionByUserId(userId);
  if (!institution) throw new ValidationError('Esta conta não tem um perfil de Instituição');
  return institution;
}

export const donationsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

/**
 * Spec 11.1.1 / 12.1 — Donor_ID always comes from the session, never the
 * request body. Multipart because the donation photo goes straight to Drive.
 */
donationsRouter.post(
  '/donations',
  requireAuth,
  requireRole('Donor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A fotografia é obrigatória');

    const fields = {
      Item_Type: req.body.Item_Type,
      Quantity: Number(req.body.Quantity),
      Condition: req.body.Condition,
      Location: { lat: Number(req.body.Location_lat), lng: Number(req.body.Location_lng) },
      City: req.body.City as string | undefined,
    };
    // Validate everything else before spending a Drive upload on a request that would fail anyway.
    assertValidDonationFields(fields);

    const photoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const donation = await createDonation(req.user!.userId, req.user!.activeCountryId, {
      ...fields,
      Photo: photoUrl,
    });
    res.status(201).json(donation);
  }),
);

/** "My Donations" (spec 9.1) — company-wide for Corporate donors, own-only for Individual. */
donationsRouter.get(
  '/donations/mine',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const donations = user.corporateAccountId
      ? await listDonationsByCorporateAccount(user.corporateAccountId)
      : await listDonationsByDonor(user.userId);
    res.json(donations);
  }),
);

/** Spec 11.1.2 — a donation may only be edited by its donor while still Pending. */
donationsRouter.patch(
  '/donations/:id',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const donation = await editDonation(req.user!.userId, req.params.id, req.body);
    res.json(donation);
  }),
);

/**
 * "Available Donations" (spec 9.2) — Pending only, verified institutions only.
 * Phase 3A Module 1: scoped to the institution's own operating country.
 */
donationsRouter.get(
  '/donations/available',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await listAvailableDonations(institution.Country_ID));
  }),
);

/** "Claimed by Me" (spec 9.2). */
donationsRouter.get(
  '/donations/claimed-by-me',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await listDonationsClaimedByInstitution(institution.Institution_ID));
  }),
);

donationsRouter.post(
  '/donations/:id/claim',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await claimDonation(institution.Institution_ID, req.params.id));
  }),
);

/** Institution App Polish module — "Confirmar recolha agendada" step, between Claim and Collect. */
donationsRouter.post(
  '/donations/:id/schedule-collection',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await scheduleCollection(institution.Institution_ID, req.params.id));
  }),
);

/** Institution App Polish module — "Marcar como recolhida" step, between Schedule and Deliver. */
donationsRouter.post(
  '/donations/:id/collect',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await markCollected(institution.Institution_ID, req.params.id));
  }),
);

donationsRouter.post(
  '/donations/:id/deliver',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await confirmDelivery(institution.Institution_ID, req.params.id));
  }),
);

/**
 * Admin Web App — sets/updates the informational Expected_Collection_Date /
 * Expected_Delivery_Date estimate. Admin-only; not gated on donation status
 * since Admin may want to set an estimate as soon as a donation is claimed.
 */
donationsRouter.patch(
  '/donations/:id/expected-dates',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const { Expected_Collection_Date, Expected_Delivery_Date } = req.body;
    res.json(
      await setExpectedDates(req.params.id, {
        expectedCollectionDate: Expected_Collection_Date,
        expectedDeliveryDate: Expected_Delivery_Date,
      }),
    );
  }),
);
