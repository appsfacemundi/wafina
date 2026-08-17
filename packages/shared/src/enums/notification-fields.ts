/**
 * Phase 3A Module 2 — the generic Notification Engine's reference vocabularies.
 * All are plain strings on the Notification type (not locked unions in the
 * database), the same "reference set, not a server-enforced whitelist" pattern
 * already used for ITEM_TYPES/CONDITIONS/GEO_LEVELS — new event/entity kinds
 * (transport, future providers) can be added purely as data, no schema change.
 */

/** What kind of record a notification is about — the deep-link target. */
export const ENTITY_TYPES = [
  'Donation',
  'Institution',
  'Dispute',
  'Change_Request',
  'Corporate_Account',
  'Success_Story',
  /** Admin Web App Parity Phase C — manual/broadcast messages have no specific record to deep-link to. */
  'Announcement',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** The specific event that fired the notification. */
export const NOTIFICATION_TYPES = [
  'donation_claimed',
  'donation_delivered',
  'institution_approved',
  'institution_rejected',
  'dispute_created',
  'dispute_resolved',
  'change_request_submitted',
  'change_request_approved',
  'change_request_rejected',
  'corporate_member_joined',
  'success_story_published',
  'success_story_approved',
  'success_story_rejected',
  /** Launch-critical, 2026-08-08 — distinct from 'success_story_rejected': this is a story that was already live (Approved) and Admin took it back down, not one that never made it out of moderation. */
  'success_story_removed',
  /** Admin Web App Parity Phase C — manual single-recipient send and scoped broadcast both use this. */
  'admin_message',
  /** RC1 RECEBER — Admin's new donation-approval gate. */
  'donation_approved',
  'donation_rejected',
  'donation_correction_requested',
  /** RC1 RECEBER — individual (People-category) reservation lifecycle. */
  'donation_reserved',
  /** Admin donation edit/cancel (V2, 2026-08-17) — Admin voided a donation on the donor's behalf. */
  'donation_cancelled',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Ready for future AI-driven prioritization; every event today maps to a fixed value. */
export const NOTIFICATION_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

/**
 * Every channel Wafina intends to eventually support. Only 'in_app' is ever
 * actually delivered today — this list exists so Delivery_Channel values are
 * meaningful in advance of any provider integration, not because SMS/WhatsApp/
 * push/email are wired up (they are not).
 */
export const DELIVERY_CHANNELS = ['in_app', 'email', 'sms', 'whatsapp', 'push'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

/**
 * Pending exists for future scheduled/reminder notifications (created but not
 * yet due to send) — today every notification goes straight to Delivered,
 * since in-app delivery is synchronous with creation.
 */
export const NOTIFICATION_STATUSES = ['Pending', 'Delivered', 'Read', 'Failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
