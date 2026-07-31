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
 */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
