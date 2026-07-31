import { randomUUID } from 'node:crypto';
import {
  institutionFieldLabel,
  type AdminChangeRequestView,
  type ChangeRequest,
  type ChangeRequestStatus,
} from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso, toSheetLatLong } from '../config/sheet-values';
import { appendRow, findRow, getRows, updateRow } from '../config/sheets';
import { getInstitutionById } from './institutions';
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
    Rejection_Reason: row.Rejection_Reason || null,
  };
}

/**
 * "Request Change" (spec 9.2, 11.5) — the only way a verified institution can
 * get a locked field changed. Admin resolves it in the Admin Web App (see
 * approveChangeRequest/rejectChangeRequest below — AppSheet is retired from
 * the architecture per the 2026-07-30 rules update, so this no longer
 * happens outside this codebase). userId is the institution's own account,
 * purely to send it the Module 2 self-confirmation notification — it is
 * never written to the row itself.
 */
export async function createChangeRequest(
  institutionId: string,
  userId: string,
  fieldRequested: string,
  reason: string,
): Promise<ChangeRequest> {
  if (!fieldRequested) throw new ValidationError('O campo a alterar é obrigatório');
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new ValidationError(`O motivo deve ter pelo menos ${MIN_REASON_LENGTH} caracteres`);
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
    message: `O seu pedido de alteração de "${institutionFieldLabel(fieldRequested)}" foi enviado ao Admin.`,
  });

  return request;
}

/** Admin moderation queue — every Pending request, with institution context to review it. */
export async function listPendingChangeRequests(): Promise<AdminChangeRequestView[]> {
  const rows = await getRows(SHEET_TABS.changeRequests);
  const pending = rows.filter((row) => row.Status === 'Pending').map(rowToChangeRequest);

  const institutionIds = new Set(pending.map((r) => r.Institution_ID));
  const institutionById = new Map(
    await Promise.all(
      Array.from(institutionIds).map(async (id) => [id, await getInstitutionById(id)] as const),
    ),
  );

  return pending.map((request) => {
    const institution = institutionById.get(request.Institution_ID);
    return {
      ...request,
      Institution_Name: institution?.Name ?? null,
      Institution_Logo: institution?.Logo ?? null,
      Field_Label: institutionFieldLabel(request.Field_Requested),
    };
  });
}

async function getChangeRequestOrThrow(requestId: string): Promise<ChangeRequest> {
  const row = await findRow(SHEET_TABS.changeRequests, (r) => r.Request_ID === requestId);
  if (!row) throw new ValidationError('Pedido de alteração não encontrado');
  return rowToChangeRequest(row);
}

/**
 * Admin approves — applies the requested new value directly to the
 * Institution row (the field stays locked afterward; this is Admin editing
 * on the institution's behalf, not an unlock). `Location` is the one field
 * that isn't a plain string on the Institution row, so it expects
 * "lat,lng" here rather than free text.
 */
export async function approveChangeRequest(requestId: string, newValue: string): Promise<ChangeRequest> {
  if (!newValue || !newValue.trim()) throw new ValidationError('É necessário indicar o novo valor para aprovar');

  const request = await getChangeRequestOrThrow(requestId);
  if (request.Status !== 'Pending') throw new ValidationError('Só é possível aprovar um pedido pendente');

  const institution = await getInstitutionById(request.Institution_ID);
  if (!institution) throw new ValidationError('Instituição não encontrada');

  const fieldPatch: Record<string, string> = {};
  if (request.Field_Requested === 'Location') {
    const [latRaw, lngRaw] = newValue.split(',').map((s) => s.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!latRaw || !lngRaw || Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new ValidationError('A localização deve ser indicada no formato "lat,lng"');
    }
    fieldPatch.Location = toSheetLatLong({ lat, lng });
  } else {
    fieldPatch[request.Field_Requested] = newValue.trim();
  }

  await updateRow(SHEET_TABS.institutions, 'Institution_ID', request.Institution_ID, fieldPatch);
  await updateRow(SHEET_TABS.changeRequests, 'Request_ID', requestId, {
    Status: 'Approved' satisfies ChangeRequestStatus,
    Date_Resolved: nowIso(),
  });

  await createNotification({
    recipientUserId: institution.User_ID,
    notificationType: 'change_request_approved',
    entityType: 'Change_Request',
    entityId: requestId,
    message: `O seu pedido de alteração de "${institutionFieldLabel(request.Field_Requested)}" foi aprovado.`,
  });

  return getChangeRequestOrThrow(requestId);
}

/**
 * Admin rejects — institution is notified with the reason; nothing changes on
 * the Institution row. Unlike approve, this doesn't require the institution
 * to still exist: if it was deleted after the request was submitted, the
 * request would otherwise be permanently stuck Pending with no way to clear
 * it from the queue, since approve can't apply a value to a row that's gone.
 * Rejecting is the only escape hatch for that orphaned case, so it must not
 * hard-fail just because the institution lookup comes back empty.
 */
export async function rejectChangeRequest(requestId: string, reason: string): Promise<ChangeRequest> {
  if (!reason || !reason.trim()) throw new ValidationError('O motivo de rejeição é obrigatório');

  const request = await getChangeRequestOrThrow(requestId);
  if (request.Status !== 'Pending') throw new ValidationError('Só é possível rejeitar um pedido pendente');

  const institution = await getInstitutionById(request.Institution_ID);

  await updateRow(SHEET_TABS.changeRequests, 'Request_ID', requestId, {
    Status: 'Rejected' satisfies ChangeRequestStatus,
    Date_Resolved: nowIso(),
    Rejection_Reason: reason.trim(),
  });

  if (institution) {
    await createNotification({
      recipientUserId: institution.User_ID,
      notificationType: 'change_request_rejected',
      entityType: 'Change_Request',
      entityId: requestId,
      message: `O seu pedido de alteração de "${institutionFieldLabel(request.Field_Requested)}" foi rejeitado. Motivo: ${reason.trim()}`,
    });
  }

  return getChangeRequestOrThrow(requestId);
}
