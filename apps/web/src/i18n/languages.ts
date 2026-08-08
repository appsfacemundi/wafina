export interface LanguageOption {
  code: 'pt' | 'en' | 'fr' | 'es' | 'zh' | 'ar';
  name: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

/** Launch-critical, 2026-08-08 — Portuguese is the default; the other five are opt-in via the flag switcher. */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'pt', name: 'Português', flag: '🇵🇹', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
];

export const DEFAULT_LANGUAGE_CODE = 'pt';
