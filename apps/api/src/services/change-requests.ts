import { randomUUID } from 'node:crypto';
import type { ChangeRequest } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow } from '../config/sheets';
import { ValidationError } from './validation-error';

const MIN_REASON_LENGTH = 5;

function rowToChangeRequest(row: Record<string, string>): ChangeRequest {
  return {
    Request_ID: row.Request_ID,
    Institution_ID: row.Institution_ID,
    Field_Requested: row.Field_Requested,
    Reason: row.Reason,
    Status: row.Status,
    Date_Requested: row.Date_Requested,
    Date_Resolved: row.Date_Resolved || null,
  };
}

/**
 * "Request Change" (spec 9.2, 11.5) — the only way a verified institution can
 * get a locked field changed. Admin resolves it (edits directly or
 * temporarily unlocks the field) exclusively in AppSheet.
 */
export async function createChangeRequest(
  institutionId: string,
  fieldRequested: string,
  reason: string,
): Promise<ChangeRequest> {
  if (!fieldRequested) throw new ValidationError('Field_Requested is required');
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new ValidationError(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
  }

  const row = {
    Request_ID: randomUUID(),
    Institution_ID: institutionId,
    Field_Requested: fieldRequested,
    Reason: reason,
    // Spec never enumerates values for this column (see packages/shared TODO) — "Pending" is
    // a plain-English placeholder; confirm against the live sheet/AppSheet queue view.
    Status: 'Pending',
    Date_Requested: nowIso(),
    Date_Resolved: '',
  };

  await appendRow(SHEET_TABS.changeRequests, row);
  return rowToChangeRequest(row);
}
