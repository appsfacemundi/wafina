export interface LanguageOption {
  code: 'pt' | 'en' | 'fr' | 'es' | 'zh' | 'ar';
  name: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

/**
 * RC1 language scope, 2026-08-12 — Portuguese and English are the only
 * RC1-supported languages (full UI coverage). fr/es/zh/ar remain valid i18n
 * locales but are deliberately not offered in this switcher yet, since their
 * in-app UI coverage isn't complete. Re-add once each is fully localized.
 */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'pt', name: 'Português', flag: '🇵🇹', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE_CODE = 'pt';
