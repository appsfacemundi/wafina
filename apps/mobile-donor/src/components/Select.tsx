import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

interface SelectOption {
  label: string;
  value: string;
  /** e.g. a "Coming Soon" country not yet launched — still listed, not selectable. Defaults to true. */
  enabled?: boolean;
}

interface SelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  // Plain strings use themselves as both label and value (e.g. ITEM_TYPES);
  // pass {label, value} pairs when the displayed text must differ from the
  // value submitted to the API (e.g. translated labels over raw field keys).
  options: readonly string[] | readonly SelectOption[];
}

export function Select({ label, value, onValueChange, options }: SelectProps) {
  const normalized: SelectOption[] = options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  );

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value} onValueChange={onValueChange}>
          {normalized.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
              enabled={option.enabled ?? true}
            />
          ))}
        </Picker>
      </View>
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
  pickerWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
