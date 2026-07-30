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
