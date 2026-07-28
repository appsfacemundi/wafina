import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';
import { ConfigurationError } from './configuration-error';
import { env, isDriveConfigured } from './env';

/**
 * Service accounts have zero Drive storage quota and can only own files
 * inside a Shared Drive — confirmed by hitting that exact error against a
 * plain shared folder before this was set up. Reuses the same service
 * account credentials as Sheets, just with the Drive scope added.
 */
let client: drive_v3.Drive | null = null;

function getClient(): drive_v3.Drive {
  if (!isDriveConfigured()) {
    throw new ConfigurationError(
      'Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DRIVE_SHARED_DRIVE_ID.',
    );
  }

  if (!client) {
    const auth = new google.auth.JWT({
      email: env.googleSheets.serviceAccountEmail,
      key: env.googleSheets.serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    client = google.drive({ version: 'v3', auth });
  }

  return client;
}

/**
 * Uploads a file to the Shared Drive, makes it publicly viewable (read-only,
 * link-only — nothing sensitive, these are donation photos), and returns a
 * direct-viewable URL to store in Donations.Photo.
 */
export async function uploadPhoto(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const drive = getClient();

  const { data } = await drive.files.create({
    requestBody: { name: filename, parents: [env.googleDrive.sharedDriveId!] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });

  const fileId = data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return `https://drive.google.com/uc?id=${fileId}`;
}
