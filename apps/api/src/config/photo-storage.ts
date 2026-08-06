import { getDriveFileStream, toProxiedUrl as toDriveProxiedUrl } from './drive';

/**
 * Storage-agnostic photo-serving abstraction (2026-08-06, alongside the
 * Drive-hotlink fix in drive.ts). Every service's row-mapping and
 * enrichment functions, plus the /photos/:id route, call through this
 * file only —
 * never drive.ts's read-side functions directly. The frontend (web and
 * native, every app) already only ever sees an opaque `/photos/:id` URL
 * and has no idea the underlying provider is Google Drive; this file is
 * what makes that true on the backend side too. Swapping storage providers
 * later (Firebase Storage, Cloudflare R2, S3, Supabase) means changing
 * this file's internals only — no route changes, no service-file changes,
 * no frontend changes, anywhere.
 *
 * `uploadPhoto` (the write side, in drive.ts) is deliberately NOT wrapped
 * here — it's only ever called from the 4 upload routes, already isolated
 * to one file, and a provider swap for new uploads doesn't need the same
 * "many scattered read call sites" problem this file solves.
 */
export function toProxiedUrl(rawUrl: string | null | undefined): string | null {
  return toDriveProxiedUrl(rawUrl);
}

export async function getPhotoStream(
  id: string,
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  return getDriveFileStream(id);
}
