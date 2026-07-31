import type { NextFunction, Request, Response } from 'express';

/**
 * Production hardening (2026-07-31) — the API had no request logging at
 * all; the only visibility into what happened was whatever a developer
 * happened to be watching in a terminal during manual testing. This is
 * deliberately minimal (one JSON line per request to stdout, no external
 * dependency) rather than a full observability stack — the goal is that
 * *some* structured trail exists once this runs somewhere real, not to
 * pick a logging platform on the stakeholder's behalf. Any log aggregator
 * (or just `journalctl`/hosting-provider logs) can ingest JSON lines from
 * stdout without further setup.
 *
 * Deliberately excludes request/response bodies — donation photos, tokens,
 * and personal data pass through this API, and logging bodies would put
 * that in plaintext log storage for no operational benefit.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const entry = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.userId ?? null,
      role: req.user?.role ?? null,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
