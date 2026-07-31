/** Admin parity Phase A (2026-07-31) — lets Admin suspend an account without deleting it. */
export const USER_STATUSES = ['Active', 'Suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
