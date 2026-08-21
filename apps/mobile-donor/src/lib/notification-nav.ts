import type { Notification } from '@wafina/shared';

/** Minimal shape both a screen's `navigation` prop and the root `NavigationContainerRef` satisfy. */
interface Navigator {
  navigate: (...args: any[]) => void;
}

/**
 * Push notifications prep (2026-08-21) — extracted from NotificationsScreen's
 * former inline navigateForEntity so a global notification-tap listener
 * (RootNavigator) can reuse the exact same deep-link logic the in-app list
 * already used. Parameterized on (entityType, entityId) instead of a full
 * Notification since a push payload only ever carries those two fields.
 * Loosely typed on purpose — a screen's own `navigation` prop and the root
 * `NavigationContainerRef` both satisfy `Navigator` but aren't the same type.
 */
export function navigateForEntity(
  navRef: Navigator,
  entityType: Notification['Entity_Type'],
  entityId?: string,
): void {
  if (entityType === 'Corporate_Account') {
    navRef.navigate('Settings');
    return;
  }
  if (entityType === 'Success_Story') {
    navRef.navigate('Impact');
    return;
  }
  navRef.navigate('MyDonations', entityType === 'Donation' && entityId ? { donationId: entityId } : undefined);
}
