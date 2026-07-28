'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

interface ProfileData {
  Name: string;
  Phone: string;
  Country: string;
}

export default function SettingsPage() {
  const session = useRequireSession();
  const { firebaseUser, refreshSession } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [corporateError, setCorporateError] = useState('');
  const [corporateSuccess, setCorporateSuccess] = useState(false);
  const [joiningCorporate, setJoiningCorporate] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setProfile(await apiFetch<ProfileData>('/donor/profile', { idToken }));
      } catch {
        setProfileError('Não foi possível carregar o seu perfil.');
      }
    })();
  }, [firebaseUser]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setProfileError('');
    setProfileSuccess(false);
    setSavingProfile(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/profile', { method: 'PATCH', idToken, body: profile });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível guardar.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onJoinCorporate(e: FormEvent) {
    e.preventDefault();
    setCorporateError('');
    setCorporateSuccess(false);
    setJoiningCorporate(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/corporate/join', { method: 'POST', idToken, body: { inviteCode } });
      await refreshSession();
      setCorporateSuccess(true);
      setInviteCode('');
    } catch (err) {
      setCorporateError(err instanceof ApiError ? err.message : 'Não foi possível associar a conta.');
    } finally {
      setJoiningCorporate(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Definições</h1>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>Perfil</p>
          {!profile && !profileError && (
            <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
          )}
          {profileError && !profile && <div className="banner banner-error">{profileError}</div>}
          {profile && (
            <form onSubmit={onSaveProfile} className="stack">
              <Input
                label="Nome"
                required
                value={profile.Name}
                onChange={(e) => setProfile({ ...profile, Name: e.target.value })}
              />
              <Input
                label="Telefone"
                required
                value={profile.Phone}
                onChange={(e) => setProfile({ ...profile, Phone: e.target.value })}
              />
              <Input
                label="País"
                required
                value={profile.Country}
                onChange={(e) => setProfile({ ...profile, Country: e.target.value })}
              />
              {profileError && <div className="banner banner-error">{profileError}</div>}
              {profileSuccess && <div className="banner banner-success">Perfil atualizado.</div>}
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'A guardar…' : 'Guardar alterações'}
              </Button>
            </form>
          )}
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>Conta corporativa</p>
          {session.donorSubtype === 'Corporate' ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
              Esta conta já está associada a uma conta corporativa.
            </p>
          ) : (
            <form onSubmit={onJoinCorporate} className="stack">
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
                Se a sua empresa tem uma parceria com a Wafina, introduza o código fornecido pelo
                Admin.
              </p>
              <Input
                label="Código de convite"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              {corporateError && <div className="banner banner-error">{corporateError}</div>}
              {corporateSuccess && (
                <div className="banner banner-success">Conta associada com sucesso.</div>
              )}
              <Button type="submit" variant="secondary" disabled={joiningCorporate}>
                {joiningCorporate ? 'A associar…' : 'Associar conta'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
