'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, Input, LanguageSwitcher } from '@wafina/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';

export default function SignInPage() {
  const { t, i18n } = useTranslation();
  const { signIn, sessionError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const displayedError = error || sessionError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      // ApiError means Firebase login succeeded but the backend rejected the
      // session (e.g. suspended account) — its message is already the right
      // one to show. Anything else is a Firebase auth error (wrong password,
      // unknown email, etc.), which needs the code-to-message mapping.
      setError(err instanceof ApiError ? err.message : friendlyAuthError((err as { code?: string }).code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen-center">
      <div style={{ position: 'absolute', top: 16, insetInlineEnd: 16 }}>
        <LanguageSwitcher
          languages={SUPPORTED_LANGUAGES}
          value={i18n.language}
          onChange={setLanguage}
          label={t('language.choose')}
        />
      </div>
      <div className="auth-brand">
        <img src="/wafina-icon-mark.png" alt="Wafina" width={104} height={87} />
        <span
          className="auth-badge"
          style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          {t('auth.badge')}
        </span>
        <h1 className="auth-welcome">{t('auth.welcome')}</h1>
        <p className="auth-tagline">{t('auth.tagline')}</p>
      </div>
      <Card className="auth-card stack">
        <form onSubmit={onSubmit} className="stack">
          <Input
            label={t('auth.email')}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t('auth.password')}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {displayedError && <div className="banner banner-error">{displayedError}</div>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
        <Button variant="ghost" fullWidth onClick={() => router.push('/sign-up')}>
          {t('auth.noAccount')}
        </Button>
      </Card>
    </main>
  );
}
