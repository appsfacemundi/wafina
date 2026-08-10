import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  createInstitution,
  getInstitutionByUserId,
  listVerifiedInstitutions,
  updateInstitutionLogo,
} from '../services/institutions';
import { ValidationError } from '../services/validation-error';

export const institutionsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

/**
 * Registration (spec 13.3) — deliberately NOT gated by requireVerified, since
 * an unverified institution submitting its profile is exactly what this is for.
 *
 * RC1 design decision, 2026-08-06: logo becomes a required part of registration
 * itself (previously only settable afterward via PATCH /institutions/me/logo),
 * so this moved from a plain JSON body to multipart — same shape as donation
 * creation (`POST /donations`), which already combines a required photo with
 * other fields in one request.
 */
institutionsRouter.post(
  '/institutions',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('O logótipo da instituição é obrigatório');

    const logoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const institution = await createInstitution(req.user!.userId, {
      Name: req.body.Name,
      Type: req.body.Type,
      Location: { lat: Number(req.body.Location_lat), lng: Number(req.body.Location_lng) },
      Logo: logoUrl,
      Needs_List: req.body.Needs_List || undefined,
      Country_ID: req.body.Country_ID,
      Region_ID: req.body.Region_ID || undefined,
      Service_Radius_Km: req.body.Service_Radius_Km ? Number(req.body.Service_Radius_Km) : undefined,
      Coverage_Area: req.body.Coverage_Area || undefined,
      Address: req.body.Address || undefined,
    });
    res.status(201).json(institution);
  }),
);

/** Verification Status screen (spec 9.2) reads this — also not gated by requireVerified. */
institutionsRouter.get(
  '/institutions/me',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  asyncHandler(async (req, res) => {
    const institution = await getInstitutionByUserId(req.user!.userId);
    res.json(institution);
  }),
);

/** Institution UX module — logo upload, reusing the same Drive path as donation/success-story photos. */
institutionsRouter.patch(
  '/institutions/me/logo',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A imagem do logótipo é obrigatória');

    const institution = await getInstitutionByUserId(req.user!.userId);
    if (!institution) throw new ValidationError('Esta conta não tem um perfil de Instituição');

    const logoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    res.json(await updateInstitutionLogo(institution.Institution_ID, logoUrl));
  }),
);

/**
 * Donor-facing browse (spec 3.2/4.1) — read-only, and only a public subset:
 * Rejection_Reason and Locked_Fields are institution/Admin-internal, not
 * something a donor browsing institutions should see. Phase 3A Module 1:
 * scoped to the donor's own Active Country — see services/institutions.ts.
 */
institutionsRouter.get(
  '/institutions',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const institutions = await listVerifiedInstitutions(req.user!.activeCountryId ?? undefined);
    res.json(
      institutions.map((institution) => ({
        Institution_ID: institution.Institution_ID,
        Name: institution.Name,
        Logo: institution.Logo,
        Type: institution.Type,
        Location: institution.Location,
        Needs_List: institution.Needs_List,
        Total_Items_Received: institution.Total_Items_Received,
        Country_ID: institution.Country_ID,
        Region_ID: institution.Region_ID,
        Coverage_Area: institution.Coverage_Area,
      })),
    );
  }),
);
