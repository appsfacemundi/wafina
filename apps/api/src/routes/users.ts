import { IMPACT_FEED_VISIBILITIES, SWITCH_PREFERENCES } from '@wafina/shared';
import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import {
  updateActiveCountry,
  updateImpactFeedVisibility,
  updateShowNameToInstitutions,
  updateSwitchPreference,
  updateUserName,
} from '../services/users';
import { ValidationError } from '../services/validation-error';

export const usersRouter = Router();

/**
 * Phase 3A Module 1 — the only two ways Active_Country_ID or Switch_Preference
 * change: an explicit Settings edit, or "Switch now" / "Never ask automatically"
 * on the GPS switch-country prompt. GPS detection alone never reaches these
 * routes on its own — the client always requires an explicit user tap first.
 * Generic (not Donor-only): Active Country is a Users-level concept, even
 * though only Donor browsing is scoped by it today (Institution browsing is
 * scoped by the institution's own Country_ID instead — see services/institutions.ts).
 */
usersRouter.patch(
  '/users/me/active-country',
  requireAuth,
  asyncHandler(async (req, res) => {
    const countryId = req.body?.countryId as string | undefined;
    if (!countryId) throw new ValidationError('countryId is required');
    await updateActiveCountry(req.user!.userId, countryId);
    res.json({ activeCountryId: countryId });
  }),
);

usersRouter.patch(
  '/users/me/switch-preference',
  requireAuth,
  asyncHandler(async (req, res) => {
    const preference = req.body?.preference as string | undefined;
    if (!preference || !SWITCH_PREFERENCES.includes(preference as (typeof SWITCH_PREFERENCES)[number])) {
      throw new ValidationError(`preference must be one of: ${SWITCH_PREFERENCES.join(', ')}`);
    }
    await updateSwitchPreference(req.user!.userId, preference as (typeof SWITCH_PREFERENCES)[number]);
    res.json({ switchPreference: preference });
  }),
);

/** Institution UX module — "Donor Name (if donor allows)" on donation cards. Opt-in. */
usersRouter.patch(
  '/users/me/show-name-to-institutions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const show = req.body?.show;
    if (typeof show !== 'boolean') throw new ValidationError('show must be a boolean');
    await updateShowNameToInstitutions(req.user!.userId, show);
    res.json({ showNameToInstitutions: show });
  }),
);

/** Launch-readiness module — Private (own donations only) vs Public (every approved story) Impact feed. */
usersRouter.patch(
  '/users/me/impact-feed-visibility',
  requireAuth,
  asyncHandler(async (req, res) => {
    const visibility = req.body?.visibility as string | undefined;
    if (!visibility || !IMPACT_FEED_VISIBILITIES.includes(visibility as (typeof IMPACT_FEED_VISIBILITIES)[number])) {
      throw new ValidationError(`visibility must be one of: ${IMPACT_FEED_VISIBILITIES.join(', ')}`);
    }
    await updateImpactFeedVisibility(req.user!.userId, visibility as (typeof IMPACT_FEED_VISIBILITIES)[number]);
    res.json({ impactFeedVisibility: visibility });
  }),
);

/** Pilot feedback, 2026-08-05 — Institution's self-service path to set the
 * signed-in account holder's own name, mirroring what Donor onboarding
 * already does for Donor accounts (see services/users.ts updateUserName). */
usersRouter.patch(
  '/users/me/name',
  requireAuth,
  asyncHandler(async (req, res) => {
    const name = req.body?.name as string | undefined;
    if (!name?.trim()) throw new ValidationError('name is required');
    await updateUserName(req.user!.userId, name.trim());
    res.json({ name: name.trim() });
  }),
);
