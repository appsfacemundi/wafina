/**
 * Security fix, 2026-08-28 — every upload route (donations, institutions,
 * admin, success-stories) previously only checked the client-declared
 * multipart Content-Type (`file.mimetype`) via multer's `fileFilter`, which
 * runs before any bytes are read and is fully attacker-controlled. A file
 * uploaded with `Content-Type: image/svg+xml` passed that check, got stored
 * on Drive with that same declared type, and was later served back from
 * `/photos/:id` with `Content-Type: image/svg+xml` — SVG can carry a
 * `<script>` payload that executes when that URL is opened directly (not
 * just inside an `<img>` tag). This checks the actual file bytes (magic
 * numbers) against the small set of raster formats this app ever legitimately
 * receives, so a mislabeled non-image (SVG or anything else) is rejected
 * regardless of what Content-Type the client claimed.
 *
 * Deliberately not using a third-party sniffing library — the four formats
 * below cover every real donation/logo/success-story photo this app has ever
 * produced (device camera/gallery photos via expo-image-picker, always
 * JPEG/PNG/WebP/HEIC-converted-to-JPEG by Expo's own default pipeline), and a
 * short, explicit allowlist is easier to audit than pulling in a dependency
 * for four fixed byte signatures.
 */
const SIGNATURES: { name: string; check: (buf: Buffer) => boolean }[] = [
  { name: 'JPEG', check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  {
    name: 'PNG',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    name: 'GIF',
    check: (buf) =>
      buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii')),
  },
  {
    name: 'WebP',
    check: (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** True only if `buffer` actually starts with the magic bytes of a real JPEG/PNG/GIF/WebP file. */
export function isValidImageBuffer(buffer: Buffer): boolean {
  return SIGNATURES.some((sig) => sig.check(buffer));
}
