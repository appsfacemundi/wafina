import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import {
  approveDonation,
  assertValidDonationFields,
  checkReceberEligibility,
  claimDonation,
  confirmDelivery,
  confirmIndividualPickup,
  createDonation,
  editDonation,
  listAvailableDonations,
  listAvailableDonationsForIndividuals,
  listDonationsByDonor,
  listDonationsClaimedByInstitution,
  listDonationsReservedByIndividual,
  listPendingReviewDonations,
  markCollected,
  rejectDonation,
  removeIndividualDonation,
  requestDonationCorrection,
  reserveDonationForIndividual,
  resubmitDonation,
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
      Recipient_Category: req.body.Recipient_Category,
      Delivery_Method: req.body.Delivery_Method,
      Location: { lat: Number(req.body.Location_lat), lng: Number(req.body.Location_lng) },
      City: req.body.City as string | undefined,
      Address: req.body.Address as string | undefined,
    };
    // Validate everything else before spending a Drive upload on a request that would fail anyway.
    assertValidDonationFields(fields);

    const photoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    // RC1: donor chooses per-donation, never trusted as an arbitrary ID from
    // the client — only ever their own session's linked company, or null.
    const corporateAccountId =
      req.body.isCorporateDonation === 'true' && req.user!.corporateAccountId
        ? req.user!.corporateAccountId
        : null;

    const donation = await createDonation(
      req.user!.userId,
      req.user!.activeCountryId,
      { ...fields, Photo: photoUrl },
      corporateAccountId,
    );
    res.status(201).json(donation);
  }),
);

/** "My Donations" (spec 9.1) — always the caller's own donations, personal or corporate. */
donationsRouter.get(
  '/donations/mine',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await listDonationsByDonor(req.user!.userId));
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
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    // RC1 RECEBER — role-aware so this route keeps working unchanged once
    // Phase 2 adds Animal_Shelter to requireRole above.
    const category = req.user!.role === 'Animal_Shelter' ? 'Animal_Shelters' : 'Institutions';
    res.json(await listAvailableDonations(category, institution.Country_ID));
  }),
);

/** "Claimed by Me" (spec 9.2). */
donationsRouter.get(
  '/donations/claimed-by-me',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await listDonationsClaimedByInstitution(institution.Institution_ID));
  }),
);

donationsRouter.post(
  '/donations/:id/claim',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    // RC1 audit fix, 2026-08-10 — same role-derived category as GET /donations/available,
    // so claiming can never succeed cross-category (see claimDonation's Recipient_Category check).
    const category = req.user!.role === 'Animal_Shelter' ? 'Animal_Shelters' : 'Institutions';
    res.json(await claimDonation(institution.Institution_ID, req.params.id, category));
  }),
);

/** Institution App Polish module — "Confirmar recolha agendada" step, between Claim and Collect. */
donationsRouter.post(
  '/donations/:id/schedule-collection',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
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
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    res.json(await markCollected(institution.Institution_ID, req.params.id));
  }),
);

donationsRouter.post(
  '/donations/:id/deliver',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
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

/** RC1 RECEBER — Admin's donation-approval queue. */
donationsRouter.get(
  '/donations/pending-review',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await listPendingReviewDonations());
  }),
);

donationsRouter.post(
  '/donations/:id/approve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await approveDonation(req.params.id));
  }),
);

donationsRouter.post(
  '/donations/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectDonation(req.params.id, req.body.reason));
  }),
);

donationsRouter.post(
  '/donations/:id/request-correction',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await requestDonationCorrection(req.params.id, req.body.reason));
  }),
);

/** RC1 RECEBER — Admin pulls an inappropriate individual donation out of RECEBER. */
donationsRouter.post(
  '/donations/:id/remove-individual',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await removeIndividualDonation(req.params.id, req.body.reason));
  }),
);

/** Donor resubmits a rejected/correction-requested donation back into the review queue. */
donationsRouter.post(
  '/donations/:id/resubmit',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await resubmitDonation(req.user!.userId, req.params.id));
  }),
);

/** RC1 RECEBER — the individual browse list: approved + People-category + not currently reserved. */
donationsRouter.get(
  '/donations/available-for-me',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (_req, res) => {
    res.json(await listAvailableDonationsForIndividuals());
  }),
);

/** RC1 RECEBER — this caller's own currently-active reservation(s), so ReceberScreen can find it again after a remount. */
donationsRouter.get(
  '/donations/reserved-by-me',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await listDonationsReservedByIndividual(req.user!.userId));
  }),
);

/**
 * RC1 RECEBER — what ReceberScreen checks before ever rendering the swipe
 * stack: eligible (free to browse), an active reservation (resume pickup),
 * or the cooldown (blocked, with the date they're free again).
 */
donationsRouter.get(
  '/donations/receber-status',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await checkReceberEligibility(req.user!.userId));
  }),
);

donationsRouter.post(
  '/donations/:id/reserve',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await reserveDonationForIndividual(req.user!.userId, req.params.id));
  }),
);

donationsRouter.post(
  '/donations/:id/confirm-received',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await confirmIndividualPickup(req.user!.userId, req.params.id));
  }),
);
