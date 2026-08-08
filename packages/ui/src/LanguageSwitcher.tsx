export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

interface LanguageSwitcherProps {
  languages: LanguageOption[];
  value: string;
  onChange: (code: string) => void;
  label: string;
}

/**
 * Launch-critical, 2026-08-08 — a plain native <select> rather than a custom
 * dropdown: it's free keyboard/screen-reader accessibility, and each
 * option's flag+name text is what makes the current language "easy to
 * identify" at a glance, per spec. Presentational only (no i18next
 * knowledge) so it works the same in every app that imports it.
 */
export function LanguageSwitcher({ languages, value, onChange, label }: LanguageSwitcherProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input lang-switcher"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
