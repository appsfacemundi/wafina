import { randomUUID } from 'node:crypto';
import type { Notification } from '@wafina/shared';
import { SHEET_TABS } from '../config/sheet-tabs';
import { fromSheetBool, nowIso, toSheetBool } from '../config/sheet-values';
import { appendRow, getRows, updateRow } from '../config/sheets';
import { ValidationError } from './validation-error';

function rowToNotification(row: Record<string, string>): Notification {
  return {
    Notification_ID: row.Notification_ID,
    User_ID: row.User_ID,
    Message: row.Message,
    Donation_ID: row.Donation_ID,
    Read: fromSheetBool(row.Read ?? ''),
    Date_Created: row.Date_Created,
  };
}

/** Spec 19 — called from claimDonation/confirmDelivery, never exposed as its own route. */
export async function createNotification(
  userId: string,
  message: string,
  donationId: string,
): Promise<void> {
  await appendRow(SHEET_TABS.notifications, {
    Notification_ID: randomUUID(),
    User_ID: userId,
    Message: message,
    Donation_ID: donationId,
    Read: toSheetBool(false),
    Date_Created: nowIso(),
  });
}

/** Inbox (spec 9.1) — newest first. */
export async function listNotificationsByUser(userId: string): Promise<Notification[]> {
  const rows = await getRows(SHEET_TABS.notifications);
  return rows
    .filter((row) => row.User_ID === userId)
    .map(rowToNotification)
    .sort((a, b) => (a.Date_Created < b.Date_Created ? 1 : -1));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const rows = await getRows(SHEET_TABS.notifications);
  const row = rows.find((r) => r.Notification_ID === notificationId);
  if (!row || row.User_ID !== userId) {
    throw new ValidationError('Notification not found');
  }
  await updateRow(SHEET_TABS.notifications, 'Notification_ID', notificationId, {
    Read: toSheetBool(true),
  });
}
