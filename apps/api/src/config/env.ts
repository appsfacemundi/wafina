import 'dotenv/config';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name];
}

const port = Number(requireEnv('PORT', '4000'));

export const env = {
  port,
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  // Base URL this API is reachable at, used to build absolute image-proxy
  // URLs. Render auto-injects RENDER_EXTERNAL_URL for every web service —
  // no manual config needed there. API_PUBLIC_URL is an explicit override
  // for any other host; localhost is the local-dev fallback.
  publicUrl:
    optionalEnv('API_PUBLIC_URL') ?? optionalEnv('RENDER_EXTERNAL_URL') ?? `http://localhost:${port}`,
  // Comma-separated list of origins allowed to call this API (the web app's dev/prod URLs).
  allowedOrigins: requireEnv('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim()),
  firebase: {
    projectId: optionalEnv('FIREBASE_PROJECT_ID'),
    clientEmail: optionalEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: optionalEnv('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
  },
  googleSheets: {
    serviceAccountEmail: optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    serviceAccountPrivateKey: optionalEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(
      /\\n/g,
      '\n',
    ),
    spreadsheetId: optionalEnv('GOOGLE_SHEETS_SPREADSHEET_ID'),
  },
  googleDrive: {
    // Same service account as Sheets. Must be a Shared Drive — plain service
    // accounts have no storage quota and cannot own files anywhere else
    // (confirmed by hitting this exact error while building this module).
    sharedDriveId: optionalEnv('GOOGLE_DRIVE_SHARED_DRIVE_ID'),
  },
  email: {
    // Notification preferences module, 2026-08-08 — Resend, chosen for a
    // simple REST API (no SDK dependency needed). Optional on purpose: email
    // sending no-ops with a warning until this is set, so the rest of the
    // app isn't blocked on obtaining the key.
    resendApiKey: optionalEnv('RESEND_API_KEY'),
    // zuinder.com must be a verified sending domain in the Resend account
    // that owns RESEND_API_KEY (SPF/DKIM records) — otherwise Resend rejects
    // the send outright regardless of what this is set to.
    fromAddress: optionalEnv('EMAIL_FROM_ADDRESS') ?? 'Wafina <wafina@zuinder.com>',
  },
};

export function isFirebaseConfigured(): boolean {
  return Boolean(env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey);
}

export function isSheetsConfigured(): boolean {
  return Boolean(
    env.googleSheets.serviceAccountEmail &&
      env.googleSheets.serviceAccountPrivateKey &&
      env.googleSheets.spreadsheetId,
  );
}

export function isDriveConfigured(): boolean {
  return Boolean(
    env.googleSheets.serviceAccountEmail &&
      env.googleSheets.serviceAccountPrivateKey &&
      env.googleDrive.sharedDriveId,
  );
}
