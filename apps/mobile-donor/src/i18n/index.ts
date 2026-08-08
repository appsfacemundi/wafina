import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import ar from './locales/ar.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from './languages';

const STORAGE_KEY = 'wafina-language';

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      zh: { translation: zh },
      ar: { translation: ar },
    },
    // Launch-critical, 2026-08-08 — Portuguese is always the default
    // regardless of device locale; AsyncStorage is async, so this starts
    // Portuguese immediately and loadPersistedLanguage() below switches to a
    // previously-chosen language once it resolves, rather than blocking app
    // startup on a storage read.
    lng: DEFAULT_LANGUAGE_CODE,
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    interpolation: { escapeValue: false },
  });
}

/** Called once at app startup — restores a previously-chosen language, if any. */
export async function loadPersistedLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved && saved !== i18next.language) {
    await i18next.changeLanguage(saved);
  }
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === (saved ?? DEFAULT_LANGUAGE_CODE));
  const shouldBeRTL = lang?.dir === 'rtl';
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(shouldBeRTL);
  }
}

/**
 * RTL layout (Arabic) needs I18nManager.forceRTL, which React Native only
 * fully applies after the JS bundle reloads — a well-known RN limitation,
 * not something fixable from JS. Text content switches immediately either
 * way; the caller is responsible for telling the user to restart when
 * `restartNeeded` comes back true.
 */
export async function setLanguage(code: string): Promise<{ restartNeeded: boolean }> {
  await i18next.changeLanguage(code);
  await AsyncStorage.setItem(STORAGE_KEY, code);

  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  const shouldBeRTL = lang?.dir === 'rtl';
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(shouldBeRTL);
    return { restartNeeded: true };
  }
  return { restartNeeded: false };
}

export default i18next;
