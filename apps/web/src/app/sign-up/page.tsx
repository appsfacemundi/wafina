'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, Input, LanguageSwitcher } from '@wafina/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { setLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';

export default function SignUpPage() {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password);
      router.replace('/');
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string }).code ?? ''));
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
      <Card className="auth-card stack">
        <h1 style={{ fontSize: 24 }}>{t('auth.createAccount')}</h1>
        <form onSubmit={onSubmit} className="stack">
          <Input
            label={t('auth.email')}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t('auth.password')}
            type="password"
            required
            minLength={6}
            hint={t('auth.passwordHint')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="banner banner-error">{error}</div>}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t('auth.creatingAccount') : t('auth.createAccount')}
          </Button>
        </form>
        <Button variant="ghost" fullWidth onClick={() => router.push('/sign-in')}>
          {t('auth.alreadyHaveAccount')}
        </Button>
      </Card>
    </main>
  );
}
