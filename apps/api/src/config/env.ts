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

export const env = {
  port: Number(requireEnv('PORT', '4000')),
  nodeEnv: requireEnv('NODE_ENV', 'development'),
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
