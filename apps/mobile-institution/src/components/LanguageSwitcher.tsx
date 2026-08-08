import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Launch-critical, 2026-08-08 — a compact flag button (not a full settings
 * row) so it's cheap to drop into any header, matching Sign In's spec need
 * to switch language before the institution user is even authenticated.
 * Opens a modal list of flag+name options — same "easy to identify"
 * requirement as web's LanguageSwitcher, just native instead of a <select>.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  async function onSelect(code: string) {
    setOpen(false);
    const { restartNeeded } = await setLanguage(code);
    if (restartNeeded) {
      Alert.alert(t('language.choose'), t('language.restartRequired'));
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('language.choose')}
        style={styles.trigger}
      >
        <Text style={styles.flag}>{current.flag}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t('language.choose')}</Text>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => onSelect(lang.code)}
                style={[styles.option, lang.code === i18n.language && styles.optionActive]}
              >
                <Text style={styles.optionFlag}>{lang.flag}</Text>
                <Text style={styles.optionName}>{lang.name}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[1],
    width: '100%',
    maxWidth: 320,
  },
  title: {
    fontFamily: 'Manrope-700',
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  optionFlag: {
    fontSize: 20,
  },
  optionName: {
    fontFamily: 'Manrope-600',
    fontSize: 14,
    color: colors.text,
  },
});
