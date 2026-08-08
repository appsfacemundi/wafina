'use client';

import { useEffect, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from './index';
import { SUPPORTED_LANGUAGES } from './languages';

/** Keeps <html lang/dir> in sync with the active language — dir matters for Arabic's right-to-left layout. */
function HtmlAttributesSync() {
  const { i18n: instance } = useTranslation();

  useEffect(() => {
    const sync = (code: string) => {
      const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
      document.documentElement.lang = lang.code;
      document.documentElement.dir = lang.dir;
    };
    sync(instance.language);
    instance.on('languageChanged', sync);
    return () => {
      instance.off('languageChanged', sync);
    };
  }, [instance]);

  return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <HtmlAttributesSync />
      {children}
    </I18nextProvider>
  );
}
