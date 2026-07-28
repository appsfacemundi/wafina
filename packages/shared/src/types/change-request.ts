export interface ChangeRequest {
  Request_ID: string;
  Institution_ID: string;
  Field_Requested: string;
  Reason: string;
  /**
   * Spec (5.2, 11.5) never enumerates exact values for this column.
   * TODO(Module 3): define the controlled list (e.g. Pending/Resolved) and
   * confirm it against whatever the Admin queue view expects.
   */
  Status: string;
  Date_Requested: string;
  Date_Resolved: string | null;
}
