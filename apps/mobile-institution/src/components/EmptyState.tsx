import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[10],
  },
  title: {
    fontFamily: 'Manrope-600',
    fontSize: 16,
    color: colors.text,
  },
  description: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
