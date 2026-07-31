import type { NextFunction, Request, Response } from 'express';
import { ConfigurationError } from '../config/configuration-error';
import { TransientServiceError } from '../services/transient-service-error';
import { ValidationError } from '../services/validation-error';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof ConfigurationError) {
    res.status(503).json({ error: err.message });
    return;
  }
  if (err instanceof TransientServiceError) {
    // Already retried with backoff in config/sheets.ts — this only fires if
    // Google Sheets was still unavailable after every attempt. 503 (not 500)
    // signals "temporary, try again" rather than "something is broken."
    res.status(503).json({ error: err.message });
    return;
  }
  // Structured to match request-logger.ts's format, so an aggregator sees one
  // consistent JSON shape whether a request finished normally or crashed —
  // plus the stack trace, which the finish-based request logger never has.
  console.error(
    JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: 500,
      userId: req.user?.userId ?? null,
      role: req.user?.role ?? null,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }),
  );
  res.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
}
