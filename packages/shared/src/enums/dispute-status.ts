export const DISPUTE_STATUSES = ['Open', 'Resolved'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
