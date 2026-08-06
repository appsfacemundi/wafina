import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

interface SelectOption {
  label: string;
  value: string;
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

// Real-device finding, 2026-08-06: @react-native-picker/picker (only
// officially supports react@16/17 per its own peerDependencies) crashed with
// a Fabric IllegalViewOperationException on a real Android phone — every
// screen using it was unusable. Swapped for a plain Modal + FlatList sheet:
// no native view manager involved at all, so it can't hit this failure mode.
// Same fix applied to the Donor app's Select.
export function Select({ label, value, onValueChange, options }: SelectProps) {
  const [open, setOpen] = useState(false);

  const normalized: SelectOption[] = options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  );
  const selected = normalized.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {selected?.label ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={normalized}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  triggerText: {
    fontFamily: 'WorkSans-400',
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 26, 32, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    maxHeight: '70%',
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.text,
    marginBottom: spacing[2],
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontFamily: 'WorkSans-400',
    fontSize: 15,
    color: colors.text,
  },
  optionTextSelected: {
    fontFamily: 'WorkSans-600',
    color: colors.accent,
  },
});
