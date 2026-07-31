import rateLimit from 'express-rate-limit';

/**
 * Production hardening (2026-07-31) — the API previously had no rate
 * limiting anywhere, flagged as the top security gap short of automated
 * tests in the Production Readiness Report. Three tiers:
 *
 * - `generalLimiter`: mounted on every route, generous enough that no real
 *   user hits it during normal use (dashboards/lists poll periodically, not
 *   continuously).
 * - `authLimiter`: on /auth/session specifically — this is the one endpoint
 *   an attacker would hammer to brute-force or abuse, even though the actual
 *   password check happens client-side against Firebase, not here.
 * - `geocodeLimiter`: on /geo-regions/geocode specifically — this proxies to
 *   the free OpenStreetMap Nominatim service, which has its own usage policy;
 *   an abusive client driving enough traffic here risks getting the app's
 *   shared IP banned by Nominatim, not just wasting this API's own resources.
 *
 * Keyed by IP (the default) rather than by authenticated user, since the
 * auth endpoint is hit *before* a session exists and geocoding is used
 * during registration/donation flows where throttling by IP is the
 * meaningful boundary anyway.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos. Tente novamente dentro de alguns minutos.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60, // generous: mobile-carrier NAT can put many real users behind one IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de início de sessão. Tente novamente dentro de alguns minutos.' },
});

export const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos de localização. Tente novamente dentro de alguns minutos.' },
});
