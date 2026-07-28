import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  assertValidDonationFields,
  createDonation,
  editDonation,
  listDonationsByCorporateAccount,
  listDonationsByDonor,
} from '../services/donations';
import { ValidationError } from '../services/validation-error';

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
    if (!req.file) throw new ValidationError('Photo is required');

    const fields = {
      Item_Type: req.body.Item_Type,
      Quantity: Number(req.body.Quantity),
      Condition: req.body.Condition,
      Location: { lat: Number(req.body.Location_lat), lng: Number(req.body.Location_lng) },
    };
    // Validate everything else before spending a Drive upload on a request that would fail anyway.
    assertValidDonationFields(fields);

    const photoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const donation = await createDonation(req.user!.userId, { ...fields, Photo: photoUrl });
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
