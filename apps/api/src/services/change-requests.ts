import { randomUUID } from 'node:crypto';
import type { ChangeRequest, ChangeRequestStatus } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow } from '../config/sheets';
import { createNotification } from './notifications';
import { ValidationError } from './validation-error';

const MIN_REASON_LENGTH = 5;

function rowToChangeRequest(row: Record<string, string>): ChangeRequest {
  return {
    Request_ID: row.Request_ID,
    Institution_ID: row.Institution_ID,
    Field_Requested: row.Field_Requested,
    Reason: row.Reason,
    Status: row.Status as ChangeRequestStatus,
    Date_Requested: row.Date_Requested,
    Date_Resolved: row.Date_Resolved || null,
  };
}

/**
 * "Request Change" (spec 9.2, 11.5) — the only way a verified institution can
 * get a locked field changed. Admin resolves it (edits directly or
 * temporarily unlocks the field) exclusively in AppSheet. userId is the
 * institution's own account, purely to send it the Module 2 self-confirmation
 * notification — it is never written to the row itself.
 */
export async function createChangeRequest(
  institutionId: string,
  userId: string,
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
    Status: 'Pending' satisfies ChangeRequestStatus,
    Date_Requested: nowIso(),
    Date_Resolved: '',
  };

  await appendRow(SHEET_TABS.changeRequests, row);
  const request = rowToChangeRequest(row);

  // Phase 3A Module 2 — self-confirmation; previously the institution got no
  // acknowledgement at all that their request was actually recorded.
  await createNotification({
    recipientUserId: userId,
    notificationType: 'change_request_submitted',
    entityType: 'Change_Request',
    entityId: request.Request_ID,
    message: `O seu pedido de alteração ao campo "${fieldRequested}" foi enviado ao Admin.`,
  });

  return request;
}
