import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'cta' | 'secondary' | 'ghost' | 'ghostBrandPink' | 'ghostDanger' | 'danger';
type Size = 'default' | 'large';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled,
  loading,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'large' && styles.baseLarge,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'cta'
              ? colors.accentText
              : variant === 'ghostBrandPink'
                ? colors.brandPink
                : colors.accent
          }
        />
      ) : (
        <Text style={[styles.text, size === 'large' && styles.textLarge, textVariantStyles[variant]]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseLarge: {
    paddingVertical: spacing[4],
    minHeight: 60,
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontFamily: 'Manrope-600',
    fontSize: 15,
  },
  textLarge: {
    fontFamily: 'Manrope-800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  // Donation-specific CTAs only ("Doar agora") — kept distinct from primary
  // (blue, general actions) so coral stays meaningful as the giving action.
  cta: { backgroundColor: colors.cta },
  secondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  // "Criar conta" on Sign In — kept visually distinct from the "ghost"
  // Forgot Password link (blue) using the logo's own pink.
  ghostBrandPink: { backgroundColor: 'transparent' },
  // Sair/sign-out — red text like a destructive action, but without the
  // solid-fill weight of `danger` (reserved for irreversible actions).
  ghostDanger: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.accentText },
  cta: { color: colors.ctaText },
  secondary: { color: colors.text },
  ghost: { color: colors.accent },
  ghostBrandPink: { color: colors.brandPink },
  ghostDanger: { color: colors.danger },
  danger: { color: colors.accentText },
});
