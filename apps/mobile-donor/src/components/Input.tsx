import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

interface InputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, style, ...props }: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.err}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing[1],
  },
  label: {
    fontFamily: 'WorkSans-600',
    fontSize: 13,
    color: colors.text,
  },
  input: {
    fontFamily: 'WorkSans-400',
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  inputError: {
    borderColor: colors.danger,
  },
  err: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.danger,
  },
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
