import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { isValidImageBuffer } from '../config/image-validation';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import { getInstitutionByUserId } from '../services/institutions';
import {
  createSuccessStory,
  listPublicSuccessStories,
  listSuccessStoriesByDonor,
  listSuccessStoriesByInstitution,
} from '../services/success-stories';
import { ValidationError } from '../services/validation-error';

async function requireOwnInstitutionId(userId: string): Promise<string> {
  const institution = await getInstitutionByUserId(userId);
  if (!institution) throw new ValidationError('Esta conta não tem um perfil de Instituição');
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
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A imagem é obrigatória');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');

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
      // multipart form fields always arrive as strings.
      Show_Donation_Details: req.body.Show_Donation_Details !== 'false',
    });
    res.status(201).json(story);
  }),
);

/** Institution's own published stories. */
successStoriesRouter.get(
  '/success-stories/mine',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  asyncHandler(async (req, res) => {
    const institutionId = await requireOwnInstitutionId(req.user!.userId);
    res.json(await listSuccessStoriesByInstitution(institutionId));
  }),
);

/**
 * Donor-facing — the pool depends on the donor's own Impact_Feed_Visibility
 * setting (Users.me/impact-feed-visibility): Private (default) is stories
 * about their own donations only; Public is every Admin-approved story
 * platform-wide. The client always calls this same endpoint either way —
 * which pool it gets is decided server-side, not by the caller.
 */
successStoriesRouter.get(
  '/donor/success-stories',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    res.json(
      req.user!.impactFeedVisibility === 'Public'
        ? await listPublicSuccessStories()
        : await listSuccessStoriesByDonor(req.user!.userId),
    );
  }),
);
