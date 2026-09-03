import { Router } from 'express';
import multer from 'multer';
import { REGISTRABLE_ROLES, type RegistrableRole } from '@wafina/shared';
import { uploadPhoto } from '../config/drive';
import { isValidImageBuffer } from '../config/image-validation';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRole } from '../middleware/auth';
import { getAdminDashboardStats } from '../services/admin-stats';
import { getAdminInsights } from '../services/admin-insights';
import {
  approveChangeRequest,
  listPendingChangeRequests,
  rejectChangeRequest,
} from '../services/change-requests';
import {
  createCorporateAccount,
  listAllCorporateAccounts,
  reactivateCorporateAccount,
  suspendCorporateAccount,
  updateCorporateAccount,
} from '../services/corporate-accounts';
import { listCollectionPoints } from '../services/collection-points';
import {
  adminCancelDonation,
  adminDeleteDonation,
  adminEditDonation,
  adminReplaceDonationPhoto,
  listAllDonationsForAdmin,
} from '../services/donations';
import { listAllOpenDisputes, resolveDispute } from '../services/disputes';
import { createCountry, listAllCountries, setCountryActive } from '../services/geo-regions';
import {
  listAllInstitutions,
  listPendingInstitutions,
  rejectInstitution,
  verifyInstitution,
} from '../services/institutions';
import { createAndSendInvitation, createInvitationCode, deactivateCode, listCodesForAccount } from '../services/invitation-codes';
import {
  broadcastNotification,
  listAdminSentNotifications,
  sendAdminNotification,
} from '../services/notifications';
import {
  adminCreateSuccessStory,
  adminQuickPublishToFeed,
  adminReplaceSuccessStoryPhoto,
  approveSuccessStory,
  listAllSuccessStories,
  listPendingSuccessStories,
  listPublishedSuccessStories,
  rejectSuccessStory,
  removeSuccessStoryFromFeed,
} from '../services/success-stories';
import { createPartner, listAllPartners, setPartnerActive, updatePartner } from '../services/partners';
import { findUserByEmail, listAllUsers, reactivateUser, setUserRole, suspendUser } from '../services/users';
import { ValidationError } from '../services/validation-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const REPORT_TYPES = ['donations', 'institutions', 'companies', 'users', 'countries', 'success-stories'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

async function getReportData(type: ReportType) {
  switch (type) {
    case 'donations':
      return listAllDonationsForAdmin();
    case 'institutions':
      return listAllInstitutions();
    case 'companies':
      return listAllCorporateAccounts();
    case 'users':
      return listAllUsers();
    case 'countries':
      return listAllCountries();
    case 'success-stories':
      return listAllSuccessStories();
  }
}

/**
 * Admin Web App foundation (Permanent Rules Update, 2026-07-30) — the first
 * REST surface for Admin actions, replacing what AppSheet did for this one
 * workflow. Deliberately narrow: institution verification only, for now.
 * Every route here is Admin-only.
 */
export const adminRouter = Router();

/** Dashboard overview — mirrors the stat-tile pattern on the Donor/Institution Home screens. */
adminRouter.get(
  '/admin/stats',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await getAdminDashboardStats());
  }),
);

/**
 * Admin Insights module, 2026-08-08 — one aggregated payload feeding the
 * geographic/statistical dashboard (map + charts). See services/admin-insights.ts.
 */
adminRouter.get(
  '/admin/insights',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await getAdminInsights());
  }),
);

adminRouter.get(
  '/admin/institutions/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingInstitutions());
  }),
);

/**
 * Real-device finding, 2026-08-04: Admin had no way to browse every
 * institution (verified + rejected included) the way the Users page already
 * allows for every user — listAllInstitutions existed but was only ever wired
 * to the Reports export. This is that same data, exposed as a real page.
 */
adminRouter.get(
  '/admin/institutions',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllInstitutions());
  }),
);

adminRouter.post(
  '/admin/institutions/:id/verify',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await verifyInstitution(req.params.id));
  }),
);

adminRouter.post(
  '/admin/institutions/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectInstitution(req.params.id, req.body?.reason));
  }),
);

/**
 * Institution App Polish module — donations Admin can set logistics
 * estimates for. Also usable in /donations/:id/expected-dates (defined in
 * donations.ts route) to actually write the estimate.
 *
 * Real-device finding, 2026-08-04: this used to call `listInFlightDonationsForAdmin`,
 * which deliberately excludes Pending donations (see that function's comment) — the
 * unintended effect was that Admin had zero visibility into a donation between
 * submission and claim anywhere in the app except Reports. Switched to
 * `listAllDonationsForAdmin` so every donation is visible here, matching the page's
 * own "view every donation" intent. Pending donations will show without collection/
 * delivery date fields making much sense yet — that's the separately logged
 * per-status date-field issue, not addressed here.
 */
adminRouter.get(
  '/admin/donations',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllDonationsForAdmin());
  }),
);

/**
 * Admin collection-code visibility, 2026-08-10 — every configured
 * collection point across every country, so the donations page can resolve
 * "where does this reservation get collected" without an N+1 lookup per
 * card. Unlike the donor-facing GET /donations/collection-point (scoped to
 * the caller's own country), Admin needs to see every country at once.
 */
adminRouter.get(
  '/admin/collection-points',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listCollectionPoints());
  }),
);

/**
 * Launch-readiness module, 2026-08-07 — photo moderation. A donor's photo
 * can be unclear, wrong, or inappropriate; before now nothing let Admin fix
 * it short of editing Sheets directly.
 */
adminRouter.patch(
  '/admin/donations/:id/photo',
  requireAuth,
  requireRole('Admin'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A fotografia é obrigatória');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    const photoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    res.json(await adminReplaceDonationPhoto(req.params.id, photoUrl));
  }),
);

/**
 * Admin donation edit/cancel (V2, 2026-08-17) — a data-entry mistake fix or a
 * donor withdrawal request reaching Admin instead of the donor themselves.
 */
adminRouter.patch(
  '/admin/donations/:id',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await adminEditDonation(req.params.id, req.body ?? {}));
  }),
);

adminRouter.post(
  '/admin/donations/:id/cancel',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await adminCancelDonation(req.params.id, req.body?.reason));
  }),
);

/** Admin donation delete, 2026-08-28 — real, permanent removal; see adminDeleteDonation's own doc comment for scope. */
adminRouter.delete(
  '/admin/donations/:id',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    await adminDeleteDonation(req.params.id);
    res.status(204).send();
  }),
);

/**
 * Admin Web App Parity gap, 2026-08-08 — lets Admin publish an Impact Feed
 * story directly for any Delivered donation, instead of only ever moderating
 * ones an institution already submitted (see adminCreateSuccessStory).
 */
adminRouter.post(
  '/admin/success-stories',
  requireAuth,
  requireRole('Admin'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A imagem é obrigatória');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    const imageUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    const story = await adminCreateSuccessStory(req.user!.userId, {
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

/**
 * One-click Feed publish, 2026-08-08 (stakeholder simplification) — the
 * common case doesn't need a new photo or written copy; it reuses the
 * donation's own photo and auto-generates title/description. No multipart
 * upload here, unlike the route above — nothing to upload.
 */
adminRouter.post(
  '/admin/donations/:id/send-to-feed',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const story = await adminQuickPublishToFeed(req.params.id, req.user!.userId);
    res.status(201).json(story);
  }),
);

/** Success Story moderation module — nothing an institution publishes is visible until Admin acts on it. */
adminRouter.get(
  '/admin/success-stories/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingSuccessStories());
  }),
);

adminRouter.post(
  '/admin/success-stories/:id/approve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await approveSuccessStory(req.params.id));
  }),
);

adminRouter.post(
  '/admin/success-stories/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectSuccessStory(req.params.id, req.body?.reason));
  }),
);

/**
 * Impact Feed management, launch-critical 2026-08-08 — every currently-live
 * story (published by an institution or by Admin directly), so Admin can
 * replace a photo or take a story down without going through Sheets by hand.
 */
adminRouter.get(
  '/admin/success-stories/published',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPublishedSuccessStories());
  }),
);

adminRouter.patch(
  '/admin/success-stories/:id/photo',
  requireAuth,
  requireRole('Admin'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('A imagem é obrigatória');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    const imageUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    res.json(await adminReplaceSuccessStoryPhoto(req.params.id, imageUrl));
  }),
);

adminRouter.post(
  '/admin/success-stories/:id/remove',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await removeSuccessStoryFromFeed(req.params.id, req.body?.reason));
  }),
);

/**
 * "Our Partners" management, launch-critical 2026-08-08 — Admin CRUD for the
 * trust-building section on the Donor Home. A new partner starts Active
 * (immediately visible); setPartnerActive pauses one without deleting its
 * profile, same lever Admin already has for countries.
 */
adminRouter.get(
  '/admin/partners',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllPartners());
  }),
);

adminRouter.post(
  '/admin/partners',
  requireAuth,
  requireRole('Admin'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('O logótipo é obrigatório');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    const logoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    const partner = await createPartner({
      Name: req.body.Name,
      Description: req.body.Description,
      Website: req.body.Website,
      Logo: logoUrl,
    });
    res.status(201).json(partner);
  }),
);

adminRouter.patch(
  '/admin/partners/:id',
  requireAuth,
  requireRole('Admin'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (req.file && !isValidImageBuffer(req.file.buffer)) {
      throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    }
    const logoUrl = req.file
      ? await uploadPhoto(req.file.buffer, `${Date.now()}-${req.file.originalname}`, req.file.mimetype)
      : undefined;
    const partner = await updatePartner(req.params.id, {
      Name: req.body.Name,
      Description: req.body.Description,
      Website: req.body.Website,
      Display_Order: req.body.Display_Order !== undefined ? Number(req.body.Display_Order) : undefined,
      Logo: logoUrl,
    });
    res.json(partner);
  }),
);

adminRouter.patch(
  '/admin/partners/:id/active',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await setPartnerActive(req.params.id, Boolean(req.body?.active)));
  }),
);

/**
 * Change Request moderation — the missing piece since AppSheet was retired
 * from the architecture (2026-07-30): institutions could already submit a
 * request to change a locked field, but nothing in this codebase let Admin
 * see or act on it until now.
 */
adminRouter.get(
  '/admin/change-requests/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingChangeRequests());
  }),
);

adminRouter.post(
  '/admin/change-requests/:id/approve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await approveChangeRequest(req.params.id, req.body?.value));
  }),
);

adminRouter.post(
  '/admin/change-requests/:id/reject',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await rejectChangeRequest(req.params.id, req.body?.reason));
  }),
);

/**
 * Users management (Admin Web App Parity module, 2026-07-31) — Admin
 * previously had no way to view, suspend, or correct a mis-registered
 * account's role. Role changes are deliberately restricted to Donor <->
 * Institution in the service layer — never a path to grant Admin access.
 */
adminRouter.get(
  '/admin/users',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllUsers());
  }),
);

adminRouter.post(
  '/admin/users/:id/suspend',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await suspendUser(req.params.id));
  }),
);

adminRouter.post(
  '/admin/users/:id/reactivate',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await reactivateUser(req.params.id));
  }),
);

adminRouter.post(
  '/admin/users/:id/role',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const role = req.body?.role as RegistrableRole;
    if (!REGISTRABLE_ROLES.includes(role)) {
      throw new ValidationError('A função deve ser Donor ou Institution');
    }
    res.json(await setUserRole(req.params.id, role));
  }),
);

/**
 * Countries management (Admin Web App Parity module, 2026-07-31) — Geo_Regions
 * already supported this at the type level ("Lets Admin launch a country by
 * flipping one flag") but no write route existed until now.
 */
adminRouter.get(
  '/admin/countries',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllCountries());
  }),
);

adminRouter.patch(
  '/admin/countries/:id',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await setCountryActive(req.params.id, Boolean(req.body?.active)));
  }),
);

adminRouter.post(
  '/admin/countries',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await createCountry(req.body?.name, req.body?.isoCode));
  }),
);

/**
 * Disputes resolution (Admin Web App Parity module, 2026-07-31) — previously
 * "exclusively in AppSheet"; stale now that AppSheet is retired.
 */
adminRouter.get(
  '/admin/disputes/pending',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllOpenDisputes());
  }),
);

adminRouter.post(
  '/admin/disputes/:id/resolve',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await resolveDispute(req.params.id, req.body?.resolutionNotes));
  }),
);

/**
 * Corporate Accounts management (Admin Web App Parity Phase B, 2026-07-31) —
 * previously "Creation stays Admin-only via AppSheet"; stale now that
 * AppSheet is retired. Invitation codes are their own entity (see
 * services/invitation-codes.ts) rather than the account ID doubling as one.
 */
adminRouter.get(
  '/admin/corporate-accounts',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAllCorporateAccounts());
  }),
);

adminRouter.post(
  '/admin/corporate-accounts',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await createCorporateAccount(req.body?.companyName, req.body?.country));
  }),
);

adminRouter.patch(
  '/admin/corporate-accounts/:id',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await updateCorporateAccount(req.params.id, req.body ?? {}));
  }),
);

/**
 * Corporate logo upload (V2, 2026-08-17) — Logo was already a writable field
 * on CorporateAccount (via the plain PATCH above), just with no way to turn
 * an uploaded file into that URL. Mirrors the partners logo upload below.
 */
adminRouter.patch(
  '/admin/corporate-accounts/:id/logo',
  requireAuth,
  requireRole('Admin'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('O logótipo é obrigatório');
    if (!isValidImageBuffer(req.file.buffer)) throw new ValidationError('O ficheiro enviado não é uma imagem válida');
    const logoUrl = await uploadPhoto(
      req.file.buffer,
      `${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );
    res.json(await updateCorporateAccount(req.params.id, { Logo: logoUrl }));
  }),
);

adminRouter.post(
  '/admin/corporate-accounts/:id/suspend',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await suspendCorporateAccount(req.params.id));
  }),
);

adminRouter.post(
  '/admin/corporate-accounts/:id/reactivate',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await reactivateCorporateAccount(req.params.id));
  }),
);

adminRouter.get(
  '/admin/corporate-accounts/:id/codes',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await listCodesForAccount(req.params.id));
  }),
);

adminRouter.post(
  '/admin/corporate-accounts/:id/codes',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const maxUses = Number(req.body?.maxUses) || 1;
    const expiresAt = req.body?.expiresAt || null;
    res.json(await createInvitationCode(req.params.id, maxUses, expiresAt));
  }),
);

/**
 * Corporate secure invitations (V2, 2026-08-17) — Admin targets one specific
 * person's email instead of generating an anonymous shareable code.
 */
adminRouter.post(
  '/admin/corporate-accounts/:id/invite',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    res.json(await createAndSendInvitation(req.params.id, req.body?.email));
  }),
);

adminRouter.post(
  '/admin/invitation-codes/:code/deactivate',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    await deactivateCode(req.params.code);
    res.json({ ok: true });
  }),
);

/**
 * Notifications (Admin Web App Parity Phase C, 2026-07-31) — Admin previously
 * had no way to message users directly; every notification was system-
 * triggered. Broadcasts are always scoped by role and/or country, never an
 * unscoped "every user" blast (Google Sheets has a real per-minute read
 * quota, already hit once this project during rapid testing).
 */
adminRouter.get(
  '/admin/notifications/sent',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (_req, res) => {
    res.json(await listAdminSentNotifications());
  }),
);

adminRouter.post(
  '/admin/notifications/send',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const email = req.body?.email as string | undefined;
    if (!email) throw new ValidationError('O e-mail é obrigatório');
    const user = await findUserByEmail(email);
    if (!user) throw new ValidationError('Nenhuma conta Wafina encontrada com esse email.');
    await sendAdminNotification(user.User_ID, req.body?.message);
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/admin/notifications/broadcast',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const sentCount = await broadcastNotification(
      { role: req.body?.role || undefined, countryId: req.body?.countryId || undefined },
      req.body?.message,
    );
    res.json({ sentCount });
  }),
);

/**
 * Reports (Admin Web App Parity Phase C, 2026-07-31) — a first pass: reuses
 * data Admin can already query elsewhere, rendered as a plain table with a
 * client-side CSV export. No new backend export format needed for this pass.
 */
adminRouter.get(
  '/admin/reports/:type',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ReportType;
    if (!REPORT_TYPES.includes(type)) {
      throw new ValidationError(`type deve ser um dos seguintes: ${REPORT_TYPES.join(', ')}`);
    }
    res.json(await getReportData(type));
  }),
);
