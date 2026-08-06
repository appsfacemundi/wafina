import { Router } from 'express';
import { getDriveFileStream } from '../config/drive';
import { asyncHandler } from '../middleware/async-handler';

export const photosRouter = Router();

/**
 * Image proxy — see the comment on `toProxiedUrl` in config/drive.ts for
 * why this exists. Intentionally public: a plain `<img src>`/RN `<Image>`
 * can't attach an Authorization header, and these files are already
 * Drive-permissioned "anyone with the link, read-only" (uploadPhoto grants
 * that on every upload), so this doesn't loosen anything. Mounted before
 * the general rate limiter in index.ts — see that file for why.
 */
photosRouter.get(
  '/photos/:fileId',
  asyncHandler(async (req, res) => {
    const { stream, mimeType } = await getDriveFileStream(req.params.fileId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
  }),
);
