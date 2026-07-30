import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import { getInstitutionByUserId } from '../services/institutions';
import {
  createSuccessStory,
  listSuccessStoriesByDonor,
  listSuccessStoriesByInstitution,
} from '../services/success-stories';
import { ValidationError } from '../services/validation-error';

async function requireOwnInstitutionId(userId: string): Promise<string> {
  const institution = await getInstitutionByUserId(userId);
  if (!institution) throw new ValidationError('No Institution profile for this account');
  return institution.Institution_ID;
}

export const successStoriesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

/** Publish (spec: Phase 3A Module 2) — verified institutions only, one image, multipart like donation photos. */
successStoriesRouter.post(
  '/success-stories',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('Image is required');

    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    const imageUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const story = await createSuccessStory(institutionId, req.user!.userId, {
      Donation_ID: req.body.Donation_ID,
      Title: req.body.Title,
      Description: req.body.Description,
      Image: imageUrl,
    });
    res.status(201).json(story);
  }),
);

/** Institution's own published stories. */
successStoriesRouter.get(
  '/success-stories/mine',
  requireAuth,
  requireRole('Institution'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    res.json(await listSuccessStoriesByInstitution(institutionId));
  }),
);

/** Donor-facing — stories about the donor's own donations only, not a public feed. */
successStoriesRouter.get(
  '/donor/success-stories',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(await listSuccessStoriesByDonor(req.user!.userId));
  }),
);
