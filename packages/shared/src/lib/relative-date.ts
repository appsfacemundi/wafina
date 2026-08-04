/**
 * Institution UX module — "Publicado há 2 dias" on donation cards. Deliberately
 * simple (days-only granularity, device-locale-free) rather than a full i18n
 * relative-time library — the only thing the card needs is a rough sense of
 * age, not second-level precision.
 */
export function daysAgoLabel(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'Publicado hoje';
  if (days === 1) return 'Publicado há 1 dia';
  return `Publicado há ${days} dias`;
}

/**
 * Institution App Polish module — dd/mm/yyyy for Expected_Collection_Date /
 * Expected_Delivery_Date. Absolute, not relative: these are future estimates,
 * so "in N days" would need constant recomputation for no real benefit over
 * a plain calendar date.
 *
 * Real-device finding, 2026-08-04: built the string manually (not
 * toLocaleDateString) so the dd/mm/yyyy format and separator are guaranteed
 * regardless of device locale/settings, not just "however pt-PT usually
 * renders it."
 */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Institution App Polish QA review (2026-07-31) — stakeholder feedback: the
 * activity timeline showed date only, but every timeline entry (Date_Claimed,
 * Date_Collection_Scheduled, etc.) is a real event timestamp, not just a
 * calendar date — losing the time was losing real information. Used only for
 * actual event timestamps, never for Expected_Collection_Date/
 * Expected_Delivery_Date (those stay date-only via formatDateLabel — an
 * estimate has no meaningful time-of-day).
 *
 * Real-device finding, 2026-08-04: explicit 24h HH:mm, not device-locale-
 * dependent — some locales/settings render 12h with AM/PM, which the
 * stakeholder didn't want.
 */
export function formatDateTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateLabel(isoDate)} ${hours}:${minutes}`;
}
