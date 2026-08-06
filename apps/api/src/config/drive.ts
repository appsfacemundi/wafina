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
 *
 * URL format (2026-07-31 fix): `drive.google.com/thumbnail?id=...`, NOT the
 * more obvious `drive.google.com/uc?id=...`. Root-caused a real bug where
 * every photo/logo rendered as a broken image in every app: the `uc?id=`
 * endpoint's final redirect target (`drive.usercontent.google.com/download`)
 * sends `Cross-Origin-Resource-Policy: same-site`, which browsers correctly
 * enforce by refusing to render it as a cross-origin `<img>` embed — it only
 * ever "worked" via curl or a direct top-level navigation, neither of which
 * is what an `<img src>` on our own domains actually does. Confirmed via a
 * direct browser probe that `thumbnail?id=` carries no such header and
 * renders correctly. `sz=w1000` caps width at 1000px, plenty for donation/
 * logo display.
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

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

/**
 * Root-caused 2026-08-06: Firefox's Enhanced Tracking Protection (on by
 * default for every Firefox user, not opt-in) blocks `drive.google.com`/
 * `googleusercontent.com` as third-party tracking-adjacent domains when
 * embedded cross-site via `<img src>` — even though the `thumbnail?id=`
 * format above has no CORP header and loads fine via direct navigation or
 * top-level fetch. Confirmed live: the same URL failed inside the real
 * rendered Admin page and succeeded when opened directly.
 *
 * Fix: proxy through our own domain instead of hotlinking Drive directly.
 * Applied at read time, not at upload time — `uploadPhoto` above is
 * intentionally unchanged, so this also fixes every already-stored URL
 * retroactively, no migration.
 *
 * Handles both the current `thumbnail?id=` format and the prior `uc?id=`
 * format (live 2026-07-28 to 2026-07-31) — same `id=` query param position
 * in both, so one extraction covers any row regardless of when it was
 * created.
 *
 * This function and `getDriveFileStream` below are Drive-specific
 * implementation details — nothing outside this file calls them directly.
 * Every service and the /photos/:id route go through config/photo-storage.ts's
 * storage-agnostic wrapper instead, so a future storage-provider swap only
 * touches that one file.
 */
export function toProxiedUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(/[?&]id=([^&]+)/);
  if (!match) return rawUrl;
  return `${env.publicUrl}/photos/${match[1]}`;
}

/**
 * Streams a Drive file's bytes back out, via config/photo-storage.ts's
 * `getPhotoStream` wrapper. `alt: 'media'` is the googleapis convention for "give me the raw
 * file content" rather than metadata.
 */
export async function getDriveFileStream(
  fileId: string,
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  const drive = getClient();

  const metadata = await drive.files.get({
    fileId,
    fields: 'mimeType',
    supportsAllDrives: true,
  });

  const { data } = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );

  return { stream: data as unknown as NodeJS.ReadableStream, mimeType: metadata.data.mimeType ?? 'image/jpeg' };
}
