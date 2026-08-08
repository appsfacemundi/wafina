'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button, Card, Input, LanguageSwitcher } from '@wafina/ui';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const { t, i18n } = useTranslation();
  const { signIn, sessionError, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') === 'not-admin' ? t('auth.notAdminError') : '');
  const [submitting, setSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const displayedError = error || sessionError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/home');
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

  // Pilot feedback, 2026-08-05: Donor/Institution already had this — Admin
  // had no self-service path if the operator forgot their own password.
  async function onForgotPassword() {
    setError('');
    setResetMessage('');
    if (!email.trim()) {
      setError(t('auth.enterEmailForReset'));
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email.trim());
      setResetMessage(t('auth.resetSent'));
    } catch {
      setResetMessage(t('auth.resetSentGeneric'));
    } finally {
      setResetting(false);
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
      <div className="auth-brand" style={{ maxWidth: 360 }}>
        <img src="/wafina-icon-mark.png" alt="Wafina" width={92} height={77} />
        <h1 className="auth-welcome" style={{ fontSize: 24 }}>{t('auth.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5, marginTop: 4 }}>
          {t('auth.subtitle')}
        </p>
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
          {resetMessage && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{resetMessage}</p>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
          <Button type="button" variant="ghost" fullWidth disabled={resetting} onClick={onForgotPassword}>
            {resetting ? t('auth.sendingReset') : t('auth.forgotPassword')}
          </Button>
        </form>
      </Card>
    </main>
  );
}
