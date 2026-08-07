import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: IoniconName;
}

export function EmptyState({ title, description, action, icon = 'file-tray-outline' }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
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
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
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
