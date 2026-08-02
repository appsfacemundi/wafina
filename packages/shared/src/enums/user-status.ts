/**
 * Admin parity Phase A (2026-07-31) — lets Admin suspend an account without deleting it.
 * 'Deleted' added for RC1 self-service donor account deletion (2026-08-02) — the row stays
 * (Donations/Success_Stories reference it by ID) but is anonymized and permanently locked out.
 */
export const USER_STATUSES = ['Active', 'Suspended', 'Deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
