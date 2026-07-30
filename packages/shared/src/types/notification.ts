import type { EntityType, NotificationPriority, NotificationStatus, NotificationType } from '../enums/notification-fields';

/**
 * Phase 3A Module 2 — the generic Notification Engine. Replaces the earlier
 * Donation-only shape (User_ID/Message/Donation_ID/Read) with a model that
 * covers every entity type Wafina has today and every one it's likely to add
 * (transport, future providers) without another schema change.
 *
 * Message stays a server-rendered, human-readable string rather than a
 * client-side template keyed off Notification_Type/Metadata — the codebase
 * has no i18n/template layer yet (a separate, already-tracked gap), and
 * rendering server-side avoids needing one just for this. Metadata is still
 * present for exactly that future upgrade: nothing here blocks moving to
 * client-rendered templates later.
 */
export interface Notification {
  Notification_ID: string;
  Notification_Type: NotificationType;
  Entity_Type: EntityType;
  Entity_ID: string;
  Recipient_User_ID: string;
  Priority: NotificationPriority;
  /** Comma-separated; only 'in_app' is ever actually delivered today. */
  Delivery_Channel: string;
  Status: NotificationStatus;
  Message: string;
  /** JSON-encoded extra context (e.g. which field a change request touched). Optional. */
  Metadata: string | null;
  Created_At: string;
  Read_At: string | null;
}
