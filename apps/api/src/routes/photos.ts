import { Router } from 'express';
import { getPhotoStream } from '../config/photo-storage';
import { asyncHandler } from '../middleware/async-handler';

export const photosRouter = Router();

/**
 * Image proxy — see config/photo-storage.ts for why this exists and stays
 * storage-agnostic. Intentionally public: a plain `<img src>`/RN `<Image>`
 * can't attach an Authorization header, and these files are already
 * permissioned "anyone with the link, read-only" on upload, so this
 * doesn't loosen anything. Mounted before the general rate limiter in
 * index.ts — see that file for why. `:id` is deliberately generic, not
 * `:fileId` — it's whatever identifier the active storage provider needs,
 * not necessarily a Drive file ID once that provider changes.
 */
photosRouter.get(
  '/photos/:id',
  asyncHandler(async (req, res) => {
    const { stream, mimeType } = await getPhotoStream(req.params.id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
  }),
);
