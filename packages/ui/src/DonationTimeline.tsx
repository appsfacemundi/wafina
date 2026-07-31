import {
  DONATION_JOURNEY_DATE_FIELD,
  DONATION_JOURNEY_STEPS,
  DONATION_STATUS_LABEL,
  formatDateLabel,
  type Donation,
} from '@wafina/shared';

/**
 * Institution App Polish module — the complete dated history of a donation's
 * journey (Aceite -> Recolha Agendada -> Recolhida -> Entregue), not just the
 * current status badge. Reached steps show their date; the current step is
 * highlighted; future steps are dimmed. Donor and Institution apps render
 * the exact same component so both sides always see an identical picture.
 */
export function DonationTimeline({ donation }: { donation: Donation }) {
  const currentIndex = (DONATION_JOURNEY_STEPS as string[]).indexOf(donation.Status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {DONATION_JOURNEY_STEPS.map((step, index) => {
        const dateField = DONATION_JOURNEY_DATE_FIELD[step];
        const date = donation[dateField];
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                flexShrink: 0,
                background: reached ? 'var(--color-accent, #c23b6f)' : 'var(--color-border, #ddd)',
                outline: isCurrent ? '3px solid var(--color-accent-soft, #f6e3ec)' : 'none',
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: isCurrent ? 700 : 400,
                color: reached ? 'var(--color-text, #222)' : 'var(--color-text-faint, #999)',
              }}
            >
              {DONATION_STATUS_LABEL[step]}
            </span>
            {date && (
              <span style={{ fontSize: 12, color: 'var(--color-text-faint, #999)' }}>
                · {formatDateLabel(date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
