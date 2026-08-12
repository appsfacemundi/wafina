import {
  DELIVERY_METHOD_LABEL_KEY,
  DONATION_JOURNEY_DATE_FIELD,
  DONATION_JOURNEY_STEPS,
  DONATION_STATUS_LABEL_KEY,
  formatDateTimeLabel,
  type Donation,
} from '@wafina/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '@/theme/tokens';

/**
 * Institution App Polish module — mirrors packages/ui/src/DonationTimeline.tsx
 * for React Native. Same logic: reached steps show their date, current step
 * is highlighted, future steps are dimmed.
 */
export function DonationTimeline({ donation }: { donation: Donation }) {
  const { t } = useTranslation();
  const currentIndex = (DONATION_JOURNEY_STEPS as string[]).indexOf(donation.Status);

  return (
    <View style={{ gap: 2 }}>
      {DONATION_JOURNEY_STEPS.map((step, index) => {
        const dateField = DONATION_JOURNEY_DATE_FIELD[step];
        const date = donation[dateField];
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <View key={step} style={styles.row}>
            <View style={[styles.dot, reached && styles.dotReached, isCurrent && styles.dotCurrent]} />
            <Text style={[styles.label, reached && styles.labelReached, isCurrent && styles.labelCurrent]}>
              {t(DONATION_STATUS_LABEL_KEY[step])}
            </Text>
            {date && <Text style={styles.date}>· {formatDateTimeLabel(date)}</Text>}
          </View>
        );
      })}
      {donation.Delivery_Method && (
        <Text style={styles.deliveryMethod}>{t(DELIVERY_METHOD_LABEL_KEY[donation.Delivery_Method])}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotReached: {
    backgroundColor: colors.accent,
  },
  dotCurrent: {
    borderWidth: 2,
    borderColor: colors.accentSoft,
  },
  label: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.textFaint,
  },
  labelReached: {
    color: colors.text,
  },
  labelCurrent: {
    fontFamily: 'Manrope-700',
  },
  date: {
    fontFamily: 'Manrope-400',
    fontSize: 11.5,
    color: colors.textFaint,
  },
  deliveryMethod: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 4,
  },
});
