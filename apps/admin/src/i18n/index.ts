import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import { DEFAULT_LANGUAGE_CODE } from './languages';

const STORAGE_KEY = 'wafina-language';

/**
 * Launch-critical, 2026-08-08 — Portuguese is always the default regardless
 * of device/browser locale (spec requirement, not a detection bug): only an
 * explicit choice, persisted from a previous visit, ever overrides it.
 */
function getInitialLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE_CODE;
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LANGUAGE_CODE;
}

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
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(code: string): void {
  i18next.changeLanguage(code);
  window.localStorage.setItem(STORAGE_KEY, code);
}

export default i18next;
