/**
 * Phase 3A Module 2 — formalizes what was previously an unenumerated string
 * (see change-request.ts's prior TODO). Admin resolution still happens
 * exclusively in AppSheet; this only defines the values that column can hold.
 */
export const CHANGE_REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];
