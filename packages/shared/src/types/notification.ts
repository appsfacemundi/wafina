/**
 * Not part of the spec's original data model — AppSheet's reference used its
 * own internal Bot/inbox mechanism, which doesn't carry over since Donor
 * leaves AppSheet. New tab, added when building the Donor Notifications
 * screen (spec 9.1, events per spec 19).
 */
export interface Notification {
  Notification_ID: string;
  User_ID: string;
  Message: string;
  Donation_ID: string;
  Read: boolean;
  Date_Created: string;
}
