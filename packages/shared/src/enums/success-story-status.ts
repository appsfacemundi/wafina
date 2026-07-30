/**
 * Phase 3A Module 2 — moderation status for Success Stories. Not yet acted on
 * by anything (no Admin Panel exists to move a story out of Approved), but the
 * column and values exist now so that capability needs no schema change later
 * — only a future Admin UI plus changing the creation default.
 */
export const SUCCESS_STORY_STATUSES = ['Approved', 'Pending', 'Rejected'] as const;
export type SuccessStoryStatus = (typeof SUCCESS_STORY_STATUSES)[number];
