import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { listActiveCountries, listAllCountries, listChildRegions } from '../services/geo-regions';

export const geoRegionsRouter = Router();

/** Country picker for onboarding, institution registration, and Home Country — active markets only. */
geoRegionsRouter.get(
  '/geo-regions/countries',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await listActiveCountries());
  }),
);

/** Settings' Active Country selector — every country, including "Coming Soon" ones not yet launched. */
geoRegionsRouter.get(
  '/geo-regions/all-countries',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await listAllCountries());
  }),
);

/** Province/Municipality/District drill-down — empty results until that depth of data exists. */
geoRegionsRouter.get(
  '/geo-regions/:id/children',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listChildRegions(req.params.id));
  }),
);
