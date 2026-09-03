import { randomUUID } from 'node:crypto';
import type { EntityType, Notification, NotificationPriority, NotificationType, Role } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { nowIso } from '../config/sheet-values';
import { appendRow, deleteRow, getRows, updateRow } from '../config/sheets';
import { sendPushBestEffort } from './push-notifications';
import { ValidationError } from './validation-error';

function rowToNotification(row: Record<string, string>): Notification {
  return {
    Notification_ID: row.Notification_ID,
    Notification_Type: row.Notification_Type as NotificationType,
    Entity_Type: row.Entity_Type as EntityType,
    Entity_ID: row.Entity_ID,
    Recipient_User_ID: row.Recipient_User_ID,
    Priority: row.Priority as NotificationPriority,
    Delivery_Channel: row.Delivery_Channel,
    Status: row.Status as Notification['Status'],
    Message: row.Message,
    Metadata: row.Metadata || null,
    Created_At: row.Created_At,
    Read_At: row.Read_At || null,
  };
}

export interface CreateNotificationInput {
  recipientUserId: string;
  notificationType: NotificationType;
  entityType: EntityType;
  entityId: string;
  message: string;
  /** Defaults to 'Normal'. Exists now for future AI-driven prioritization; every call site today passes a fixed value per event. */
  priority?: NotificationPriority;
  /** Arbitrary extra context, JSON-stringified by the caller if needed. */
  metadata?: string;
}

/**
 * Phase 3A Module 2 — the generic Notification Engine's single write path.
 * Every event in the platform (donation lifecycle, disputes, change requests,
 * corporate membership, success stories, and whatever gets added later) goes
 * through this one function — never exposed as its own route, only ever
 * called from the service that owns the triggering action.
 *
 * Delivery_Channel is hardcoded to 'in_app' and Status to 'Delivered' because
 * that's the only channel actually wired up today (no email/SMS/WhatsApp/push
 * provider is integrated — see Notification_Type's own doc comment). Status
 * would only start at 'Pending' for a future scheduled/reminder notification
 * that isn't due to send yet; nothing in this codebase creates one of those.
 */
/**
 * Institution App Polish module (found during QA review, 2026-07-31) —
 * failures here are swallowed (logged, not thrown) on purpose. Every caller
 * of this function has already completed its real state-changing write
 * (e.g. claimDonation already marked the donation Claimed) before sending the
 * notification; letting a transient failure here (a Sheets 429 during a
 * burst of requests was the real-world trigger) bubble up as a 500 falsely
 * told the client the whole action failed, when the donation had actually
 * already been claimed — the client would show "Internal server error" and
 * a retry would then fail for a *different*, confusing reason ("Donation is
 * no longer available"). A missed in-app notification is a strictly better
 * failure mode than that.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await appendRow(SHEET_TABS.notifications, {
      Notification_ID: randomUUID(),
      Notification_Type: input.notificationType,
      Entity_Type: input.entityType,
      Entity_ID: input.entityId,
      Recipient_User_ID: input.recipientUserId,
      Priority: input.priority ?? 'Normal',
      Delivery_Channel: 'in_app',
      Status: 'Delivered',
      Message: input.message,
      Metadata: input.metadata ?? '',
      Created_At: nowIso(),
      Read_At: '',
    });
  } catch (err) {
    console.error('createNotification failed (swallowed, does not fail the caller\'s action):', err);
  }

  // Push notifications prep (2026-08-21) — best-effort side channel on top of
  // the in-app row above; see sendPushBestEffort's own doc comment for why
  // this can never throw or affect the caller's action either.
  await sendPushBestEffort(input.recipientUserId, 'Wafina', input.message, {
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

/** Inbox (spec 9.1) — newest first. */
export async function listNotificationsByUser(userId: string): Promise<Notification[]> {
  const rows = await getRows(SHEET_TABS.notifications);
  return rows
    .filter((row) => row.Recipient_User_ID === userId)
    .map(rowToNotification)
    .sort((a, b) => (a.Created_At < b.Created_At ? 1 : -1));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const rows = await getRows(SHEET_TABS.notifications);
  const row = rows.find((r) => r.Notification_ID === notificationId);
  if (!row || row.Recipient_User_ID !== userId) {
    throw new ValidationError('Notificação não encontrada');
  }
  await updateRow(SHEET_TABS.notifications, 'Notification_ID', notificationId, {
    Status: 'Read',
    Read_At: nowIso(),
  });
}

/** Admin Web App Parity Phase C — a single manually-composed message to one user. */
export async function sendAdminNotification(recipientUserId: string, message: string): Promise<void> {
  if (!message || !message.trim()) throw new ValidationError('A mensagem é obrigatória.');
  await createNotification({
    recipientUserId,
    notificationType: 'admin_message',
    entityType: 'Announcement',
    entityId: 'admin',
    message: message.trim(),
  });
}

export interface BroadcastFilter {
  role?: Role;
  countryId?: string;
}

/**
 * Scoped broadcast — deliberately requires at least a role or a country
 * filter, never "every user, every country" in one call. Google Sheets has a
 * real per-minute read-quota (already hit once this project during rapid
 * testing), and createNotification's own append-per-recipient loop would
 * otherwise scale directly with total user count with no ceiling.
 */
export async function broadcastNotification(filter: BroadcastFilter, message: string): Promise<number> {
  if (!message || !message.trim()) throw new ValidationError('A mensagem é obrigatória.');
  if (!filter.role && !filter.countryId) {
    throw new ValidationError('Escolha pelo menos um filtro (tipo de conta ou país).');
  }

  const userRows = await getRows(SHEET_TABS.users);
  const targets = userRows.filter((row) => {
    if (filter.role && row.Role !== filter.role) return false;
    if (filter.countryId && row.Active_Country_ID !== filter.countryId) return false;
    return true;
  });

  await Promise.all(
    targets.map((row) =>
      createNotification({
        recipientUserId: row.User_ID,
        notificationType: 'admin_message',
        entityType: 'Announcement',
        entityId: 'admin',
        message: message.trim(),
      }),
    ),
  );

  return targets.length;
}

/** Admin's notification-history view — every admin-originated message ever sent, newest first. */
export async function listAdminSentNotifications(): Promise<Notification[]> {
  const rows = await getRows(SHEET_TABS.notifications);
  return rows
    .filter((row) => row.Notification_Type === 'admin_message')
    .map(rowToNotification)
    .sort((a, b) => (a.Created_At < b.Created_At ? 1 : -1));
}

/**
 * Admin donation delete follow-up, 2026-08-28 — called after a hard delete
 * (e.g. adminDeleteDonation) so existing notifications don't keep pointing at
 * an Entity_ID that no longer exists. Deliberately sequential (one deleteRow
 * fully completes, including its cache invalidation, before the next one
 * reads the tab) — deleteRow shifts every row below the one it removes, so
 * two deletes racing on the same tab could each compute a position the
 * other's delete has already shifted out from under it. Best-effort: logs
 * and stops on the first failure rather than throwing, matching
 * createNotification's own "never fail the caller's real action over this"
 * philosophy — the caller has usually already done the action that matters
 * (e.g. deleted the donation itself) by the time this runs.
 */
export async function deleteNotificationsForEntity(entityType: EntityType, entityId: string): Promise<void> {
  try {
    const rows = await getRows(SHEET_TABS.notifications);
    const toDelete = rows.filter((r) => r.Entity_Type === entityType && r.Entity_ID === entityId);
    for (const row of toDelete) {
      await deleteRow(SHEET_TABS.notifications, 'Notification_ID', row.Notification_ID);
    }
  } catch (err) {
    console.error('deleteNotificationsForEntity failed (swallowed, does not fail the caller\'s action):', err);
  }
}
