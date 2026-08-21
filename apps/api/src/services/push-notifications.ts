import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { SHEET_TABS } from '../config/sheet-tabs';
import { getRows, updateRow } from '../config/sheets';

const expo = new Expo();

/**
 * Push notifications prep (2026-08-21) — best-effort delivery accelerant on
 * top of an already-created in-app Notification. Mirrors createNotification's
 * own error-swallowing contract (see its doc comment in notifications.ts):
 * the in-app row is always the source of truth, so a push failure here must
 * never surface as a failure of whatever action triggered the notification.
 * Never throws.
 */
export async function sendPushBestEffort(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const rows = await getRows(SHEET_TABS.users);
    const token = rows.find((row) => row.User_ID === recipientUserId)?.Push_Token;
    if (!token || !Expo.isExpoPushToken(token)) return;

    const message: ExpoPushMessage = { to: token, title, body, data, sound: 'default' };
    const [ticket] = await expo.sendPushNotificationsAsync([message]);

    // A stale token (app uninstalled, permission revoked at the OS level,
    // etc.) — clear it so future sends don't keep paying the round trip.
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      await updateRow(SHEET_TABS.users, 'User_ID', recipientUserId, { Push_Token: '' });
    }
  } catch (err) {
    console.error('sendPushBestEffort failed (swallowed):', err);
  }
}
