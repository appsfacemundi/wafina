import { Router } from 'express';
import multer from 'multer';
import { uploadPhoto } from '../config/drive';
import { isValidImageBuffer } from '../config/image-validation';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import {
  approveDonation,
  assertValidDonationFields,
  assertValidPhotoCount,
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
  verifyCollectionCode,
} from '../services/donations';
import { getCollectionPointForCountry } from '../services/collection-points';
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
  // V2 multi-photo (2026-08-17) — `files: 10` bounds a broken/malicious
  // client's file count before assertValidPhotoCount's own 10-photo check
  // even runs.
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

/**
 * V2 multi-photo (2026-08-17) — accepts the new plural `photos` field (up to
 * 10) and still recognizes the legacy singular `photo` field, so a donor
 * still running a pre-V2 mobile build keeps working against this API without
 * forcing every installed build to update simultaneously (decoupled EAS/
 * Render deploys — see the plan's migration section).
 */
const uploadPhotos = upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'photo', maxCount: 1 },
]);

function extractPhotoFiles(req: { files?: unknown }): Express.Multer.File[] {
  const files = req.files as { photos?: Express.Multer.File[]; photo?: Express.Multer.File[] } | undefined;
  return files?.photos?.length ? files.photos : (files?.photo ?? []);
}

/**
 * Security fix, 2026-08-28 — multer's fileFilter only checks the
 * client-declared Content-Type, not the actual bytes. This rejects anything
 * whose real content doesn't match a known raster image format, regardless
 * of what the upload claimed to be — see config/image-validation.ts.
 */
function assertValidImageFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    if (!isValidImageBuffer(file.buffer)) {
      throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    }
  }
}

/**
 * V2 multi-photo (2026-08-17) — a single-photo upload endpoint, used by
 * mobile-donor's new multi-photo picker: `expo-file-system`'s `uploadAsync`
 * (the existing, device-tested fix for RN FormData breaking on Android —
 * see mobile-donor's lib/api.ts) only ever sends ONE file per multipart
 * request, so a 10-photo submission uploads each photo individually here
 * first, then creates/edits the donation as a plain JSON request carrying
 * the resulting URLs (see the JSON-body branch on POST /donations and
 * PATCH /donations/:id below). Legacy single-multipart-request clients are
 * unaffected — they never call this route at all.
 */
donationsRouter.post(
  '/donations/photos',
  requireAuth,
  requireRole('Donor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A fotografia é obrigatória');
    assertValidImageFiles([req.file]);
    const url = await uploadPhoto(req.file.buffer, `${Date.now()}-${req.file.originalname}`, req.file.mimetype);
    res.status(201).json({ url });
  }),
);

/**
 * Reads the photo URLs for this request regardless of how they arrived:
 * multipart files (legacy single-request clients, via `extractPhotoFiles`)
 * take priority; otherwise falls back to a JSON `Photos` array of URLs
 * already uploaded via POST /donations/photos (current mobile-donor).
 */
async function resolvePhotoUrls(req: {
  files?: unknown;
  body: Record<string, unknown>;
}): Promise<string[]> {
  const photoFiles = extractPhotoFiles(req);
  if (photoFiles.length > 0) {
    assertValidPhotoCount(photoFiles.length);
    assertValidImageFiles(photoFiles);
    return Promise.all(
      photoFiles.map((file) => uploadPhoto(file.buffer, `${Date.now()}-${file.originalname}`, file.mimetype)),
    );
  }
  const photos = req.body.Photos;
  if (Array.isArray(photos) && photos.every((p) => typeof p === 'string')) {
    assertValidPhotoCount(photos.length);
    return photos as string[];
  }
  return [];
}

/**
 * Spec 11.1.1 / 12.1 — Donor_ID always comes from the session, never the
 * request body. Accepts either a legacy single-request multipart upload or
 * (current mobile-donor) plain JSON with pre-uploaded photo URLs — see
 * resolvePhotoUrls.
 */
donationsRouter.post(
  '/donations',
  requireAuth,
  requireRole('Donor'),
  uploadPhotos,
  asyncHandler(async (req, res) => {
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
    // Validate everything else first: for a legacy multipart client this
    // avoids spending a Drive upload (inside resolvePhotoUrls, next) on a
    // request that would fail anyway; for the JSON-URLs path the photos are
    // already uploaded either way, so this ordering costs nothing there.
    assertValidDonationFields(fields);

    const photoUrls = await resolvePhotoUrls(req);
    assertValidPhotoCount(photoUrls.length);

    // RC1: donor chooses per-donation, never trusted as an arbitrary ID from
    // the client — only ever their own session's linked company, or null.
    const corporateAccountId =
      req.body.isCorporateDonation === 'true' && req.user!.corporateAccountId
        ? req.user!.corporateAccountId
        : null;

    const donation = await createDonation(
      req.user!.userId,
      req.user!.activeCountryId,
      { ...fields, Photos: photoUrls },
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

/**
 * Spec 11.1.2 — a donation may only be edited by its donor while still Pending.
 *
 * RC1 rejection-loop fix, 2026-08-13 — multipart (not JSON) so a donor
 * correcting a rejected donation can also replace the photo, matching the
 * create route's shape. The photo is optional here (unlike create): a
 * correction that's purely textual (wrong Item_Type, wrong quantity) doesn't
 * need to re-upload the existing one. V2 multi-photo (2026-08-17) — photo
 * replacement is now whole-set: sending any `photos`/`photo` files replaces
 * the entire array (matches how the mobile UI manages the full set
 * client-side), not an add/remove-single-photo API. No files present leaves
 * the existing Photos untouched.
 */
donationsRouter.patch(
  '/donations/:id',
  requireAuth,
  requireRole('Donor'),
  uploadPhotos,
  asyncHandler(async (req, res) => {
    const patch: Record<string, unknown> = {};
    if (req.body.Item_Type !== undefined) patch.Item_Type = req.body.Item_Type;
    if (req.body.Quantity !== undefined) patch.Quantity = Number(req.body.Quantity);
    if (req.body.Condition !== undefined) patch.Condition = req.body.Condition;
    if (req.body.Recipient_Category !== undefined) patch.Recipient_Category = req.body.Recipient_Category;
    if (req.body.Delivery_Method !== undefined) patch.Delivery_Method = req.body.Delivery_Method;
    if (req.body.City !== undefined) patch.City = req.body.City;
    if (req.body.Address !== undefined) patch.Address = req.body.Address;
    if (req.body.Location_lat !== undefined && req.body.Location_lng !== undefined) {
      patch.Location = { lat: Number(req.body.Location_lat), lng: Number(req.body.Location_lng) };
    }
    const photoUrls = await resolvePhotoUrls(req);
    if (photoUrls.length > 0) patch.Photos = photoUrls;
    const donation = await editDonation(req.user!.userId, req.params.id, patch);
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
    res.json(await listAvailableDonations(category, institution.Country_ID, institution.Location));
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
    res.json(await listDonationsClaimedByInstitution(institution.Institution_ID, institution.Location));
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
    // Country-routing fix, 2026-08-10 — same country the institution's own
    // browse list is already scoped to (institution.Country_ID), so claiming
    // can never succeed cross-country either.
    res.json(await claimDonation(institution.Institution_ID, req.params.id, category, institution.Country_ID));
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

/**
 * Donation lifecycle emails, 2026-08-11 — photo/message are both optional
 * (per spec: the receiver's thank-you note is a private, optional add-on,
 * never required to confirm delivery). Multipart only because the photo
 * upload reuses the same Drive path as donation creation; `thankYouMessage`
 * comes through as an ordinary form field alongside it.
 */
donationsRouter.post(
  '/donations/:id/deliver',
  requireAuth,
  requireRole('Institution', 'Animal_Shelter'),
  requireVerified,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const institution = await requireOwnInstitution(req.user!.userId);
    if (req.file) assertValidImageFiles([req.file]);
    const thankYouPhoto = req.file
      ? await uploadPhoto(req.file.buffer, `${Date.now()}-${req.file.originalname}`, req.file.mimetype)
      : undefined;
    res.json(
      await confirmDelivery(
        institution.Institution_ID,
        req.params.id,
        req.body.thankYouMessage as string | undefined,
        thankYouPhoto,
      ),
    );
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

/**
 * RC1 RECEBER — the individual browse list: approved + People-category +
 * caller's own country + not currently reserved.
 *
 * Country-routing fix, 2026-08-10 — scoped to the caller's own
 * activeCountryId, the same session field createDonation already trusts as
 * the source of truth for a user's country (never client-supplied).
 */
donationsRouter.get(
  '/donations/available-for-me',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    if (!req.user!.activeCountryId) {
      throw new ValidationError('Complete o seu perfil (incluindo o país) antes de usar o Receber');
    }
    res.json(await listAvailableDonationsForIndividuals(req.user!.activeCountryId));
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
    if (!req.user!.activeCountryId) {
      throw new ValidationError('Complete o seu perfil (incluindo o país) antes de usar o Receber');
    }
    res.json(await reserveDonationForIndividual(req.user!.userId, req.params.id, req.user!.activeCountryId));
  }),
);

/**
 * Donation lifecycle emails, 2026-08-11 — same optional photo/message
 * pattern as /donations/:id/deliver above.
 */
donationsRouter.post(
  '/donations/:id/confirm-received',
  requireAuth,
  requireRole('Donor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (req.file) assertValidImageFiles([req.file]);
    const thankYouPhoto = req.file
      ? await uploadPhoto(req.file.buffer, `${Date.now()}-${req.file.originalname}`, req.file.mimetype)
      : undefined;
    res.json(
      await confirmIndividualPickup(
        req.user!.userId,
        req.params.id,
        req.body.thankYouMessage as string | undefined,
        thankYouPhoto,
      ),
    );
  }),
);

/**
 * Collection-point flow, 2026-08-10 — the recipient types the 4-digit code
 * Wafina staff gave them at the collection point after verifying their
 * Wafina ID. Success only unlocks Confirmar recebimento; it never touches
 * the 3-day cooldown (see verifyCollectionCode's doc comment).
 */
donationsRouter.post(
  '/donations/:id/verify-collection-code',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    const code = req.body?.code as string | undefined;
    if (!code) throw new ValidationError('O código é obrigatório');
    res.json(await verifyCollectionCode(req.user!.userId, req.params.id, code));
  }),
);

/**
 * Collection-point flow, 2026-08-10 — where the recipient's active
 * reservation can be physically collected. Scoped to the caller's own
 * Active_Country_ID (same field every other country-routing check already
 * trusts) — never the donation's Country_ID directly, though by the country
 * isolation invariant they're always identical for an active reservation.
 */
donationsRouter.get(
  '/donations/collection-point',
  requireAuth,
  requireRole('Donor'),
  asyncHandler(async (req, res) => {
    if (!req.user!.activeCountryId) {
      throw new ValidationError('Complete o seu perfil (incluindo o país) antes de usar o Receber');
    }
    res.json(await getCollectionPointForCountry(req.user!.activeCountryId));
  }),
);
