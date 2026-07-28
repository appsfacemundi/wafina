import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.surface2, fg: colors.textMuted },
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
  },
  text: {
    fontFamily: 'WorkSans-600',
    fontSize: 12,
  },
});
