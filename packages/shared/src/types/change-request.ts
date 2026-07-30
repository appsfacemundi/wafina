import type { ChangeRequestStatus } from '../enums/change-request-status';

export interface ChangeRequest {
  Request_ID: string;
  Institution_ID: string;
  Field_Requested: string;
  Reason: string;
  /** Formalized in Phase 3A Module 2 — see enums/change-request-status.ts. */
  Status: ChangeRequestStatus;
  Date_Requested: string;
  Date_Resolved: string | null;
}
