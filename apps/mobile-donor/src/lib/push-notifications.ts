import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Push notifications prep (2026-08-21) — requests OS permission (no-op if
 * already decided) and registers the resulting Expo push token with the
 * backend. Silently does nothing on a simulator/Expo Go, where a real,
 * deliverable push token can't be obtained.
 */
export async function registerForPushNotifications(idToken: string): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await apiFetch('/users/me/push-token', { method: 'PATCH', idToken, body: { token } });
}

/** Best-effort clear, called on sign-out so a shared/reused device doesn't keep receiving the previous user's pushes. Must run before Firebase sign-out invalidates idToken. */
export async function clearPushToken(idToken: string): Promise<void> {
  try {
    await apiFetch('/users/me/push-token', { method: 'PATCH', idToken, body: { token: '' } });
  } catch {
    // Non-critical — a stale token just gets cleared server-side next time DeviceNotRegistered comes back.
  }
}
