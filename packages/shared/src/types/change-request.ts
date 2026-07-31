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
  /** Stabilization module (2026-07-31) — set when Admin rejects, shown to the institution. Null otherwise. */
  Rejection_Reason: string | null;
}

/** Admin moderation queue — same request plus enough institution context to review it. */
export interface AdminChangeRequestView extends ChangeRequest {
  Institution_Name: string | null;
  Institution_Logo: string | null;
  /** Human label for Field_Requested (e.g. "Itens Necessários"), never the raw Sheet column name. */
  Field_Label: string;
}
