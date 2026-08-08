'use client';

import { MEDICAL_SUPPLY_EXAMPLES, type GeoRegion, type ImpactFeedVisibility, type SwitchPreference } from '@wafina/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Input, Select, useToast } from '@wafina/ui';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { simulateCountryDetection } from '@/lib/dev-country-simulator';

const IS_DEV_BUILD = process.env.NODE_ENV !== 'production';

/** The 5 countries geo-detect.ts can actually recognize from coordinates today. */
const SIMULATABLE_COUNTRIES = [
  { label: 'Angola', isoCode: 'AO' },
  { label: 'Portugal', isoCode: 'PT' },
  { label: 'Brasil', isoCode: 'BR' },
  { label: 'Moçambique', isoCode: 'MZ' },
  { label: 'Cabo Verde', isoCode: 'CV' },
];

interface ProfileData {
  Name: string;
  Phone: string;
  Home_Country_ID: string;
}

export default function SettingsPage() {
  const session = useRequireSession();
  const { firebaseUser, refreshSession, signOutUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [allCountries, setAllCountries] = useState<GeoRegion[] | null>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [corporateError, setCorporateError] = useState('');
  const [corporateSuccess, setCorporateSuccess] = useState(false);
  const [joiningCorporate, setJoiningCorporate] = useState(false);

  const [countryError, setCountryError] = useState('');
  const [countrySuccess, setCountrySuccess] = useState(false);
  const [switchingCountry, setSwitchingCountry] = useState(false);

  const [savingNamePref, setSavingNamePref] = useState(false);
  const [savingFeedPref, setSavingFeedPref] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [profileData, countryList, allCountryList] = await Promise.all([
          apiFetch<ProfileData>('/donor/profile', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        ]);
        setProfile(profileData);
        setCountries(countryList);
        setAllCountries(allCountryList);
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
      // Editing Home Country here deliberately does NOT change Active Country —
      // that's the separate, explicit action below. See api/services/users.ts.
      await apiFetch('/donor/profile', { method: 'PATCH', idToken, body: profile });
      setProfileSuccess(true);
      showToast('Perfil atualizado com sucesso.');
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
      showToast('Conta corporativa associada com sucesso.');
    } catch (err) {
      setCorporateError(err instanceof ApiError ? err.message : 'Não foi possível associar a conta.');
    } finally {
      setJoiningCorporate(false);
    }
  }

  async function onChangeActiveCountry(countryId: string) {
    setCountryError('');
    setCountrySuccess(false);
    setSwitchingCountry(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/active-country', { method: 'PATCH', idToken, body: { countryId } });
      await refreshSession();
      setCountrySuccess(true);
      showToast('País ativo alterado com sucesso.');
    } catch (err) {
      setCountryError(err instanceof ApiError ? err.message : 'Não foi possível mudar de país.');
    } finally {
      setSwitchingCountry(false);
    }
  }

  async function onChangeSwitchPreference(preference: SwitchPreference) {
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/switch-preference', { method: 'PATCH', idToken, body: { preference } });
      await refreshSession();
    } catch {
      // Non-critical — the prompt simply keeps showing if this silently fails.
    }
  }

  async function onChangeShowName(show: boolean) {
    setSavingNamePref(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/show-name-to-institutions', { method: 'PATCH', idToken, body: { show } });
      await refreshSession();
      showToast('Preferência de privacidade atualizada.');
    } catch {
      // Non-critical — the toggle simply reverts to its saved value on next load if this fails.
    } finally {
      setSavingNamePref(false);
    }
  }

  async function onChangeImpactFeedVisibility(visibility: ImpactFeedVisibility) {
    setSavingFeedPref(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/impact-feed-visibility', { method: 'PATCH', idToken, body: { visibility } });
      await refreshSession();
      showToast('Preferência do feed de impacto atualizada.');
    } catch {
      // Non-critical — the toggle simply reverts to its saved value on next load if this fails.
    } finally {
      setSavingFeedPref(false);
    }
  }

  async function onDeleteAccount() {
    if (!session || deleteConfirmEmail.trim().toLowerCase() !== session.email.toLowerCase()) return;
    setDeleteError('');
    setDeleting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/account', { method: 'DELETE', idToken });
      showToast('A sua conta foi eliminada.');
      await signOutUser();
      router.replace('/sign-in');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível eliminar a conta.');
      setDeleting(false);
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
          {profile && countries && (
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
              <Select
                label="País de origem"
                required
                value={profile.Home_Country_ID}
                onChange={(e) => setProfile({ ...profile, Home_Country_ID: e.target.value })}
              >
                {countries.map((c) => (
                  <option key={c.Region_ID} value={c.Region_ID}>
                    {c.Name}
                  </option>
                ))}
              </Select>
              {profileError && <div className="banner banner-error">{profileError}</div>}
              {profileSuccess && <div className="banner banner-success">Perfil atualizado.</div>}
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'A guardar…' : 'Guardar alterações'}
              </Button>
            </form>
          )}
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>País ativo</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Determina quais as instituições e doações que vê. Mudar de país nunca altera doações já
            submetidas.
          </p>
          {allCountries && session.activeCountryId && (
            <div className="stack">
              <Select
                label="País ativo"
                value={session.activeCountryId}
                onChange={(e) => onChangeActiveCountry(e.target.value)}
                disabled={switchingCountry}
              >
                {allCountries.map((c) => (
                  <option key={c.Region_ID} value={c.Region_ID} disabled={!c.Active}>
                    {c.Active ? c.Name : `${c.Name} — Brevemente`}
                  </option>
                ))}
              </Select>
              {countryError && <div className="banner banner-error">{countryError}</div>}
              {countrySuccess && <div className="banner banner-success">País ativo atualizado.</div>}
              <Select
                label="Sugerir mudança ao detetar viagem?"
                value={session.switchPreference ?? 'Always_Ask'}
                onChange={(e) => onChangeSwitchPreference(e.target.value as SwitchPreference)}
              >
                <option value="Always_Ask">Perguntar sempre</option>
                <option value="Never_Ask_Automatically">Nunca perguntar automaticamente</option>
              </Select>
            </div>
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

        {/* Donation categories reference, 2026-08-07 — a donor deciding whether an item qualifies as 'Material Médico' needs this once, not every time they open the Donate form (see MEDICAL_SUPPLY_INFO's comment in @wafina/shared). */}
        <Card className="stack">
          <p style={{ fontWeight: 600 }}>O que conta como &quot;Material Médico&quot;?</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Material médico limpo e funcional — nunca medicamentos. Exemplos:
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {MEDICAL_SUPPLY_EXAMPLES.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.emoji}</span>
                <span style={{ fontSize: 13.5 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>Privacidade</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Se ativar, a instituição que aceitar uma doação sua vê o seu nome e número de telefone
            no cartão da doação, para poder combinar a recolha consigo. Caso contrário, a doação
            aparece sem identificação pessoal — a instituição vê apenas a localização e a morada
            que indicar.
          </p>
          <Select
            label="Mostrar o meu nome às instituições"
            value={session.showNameToInstitutions ? 'yes' : 'no'}
            onChange={(e) => onChangeShowName(e.target.value === 'yes')}
            disabled={savingNamePref}
          >
            <option value="no">Não mostrar</option>
            <option value="yes">Mostrar o meu nome</option>
          </Select>
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>Feed de Impacto</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Privado mostra apenas histórias sobre as suas próprias doações. Público mostra também
            histórias aprovadas sobre doações de outras pessoas, para ver o impacto de toda a
            comunidade Wafina.
          </p>
          <Select
            label="Visibilidade do feed"
            value={session.impactFeedVisibility ?? 'Private'}
            onChange={(e) => onChangeImpactFeedVisibility(e.target.value as ImpactFeedVisibility)}
            disabled={savingFeedPref}
          >
            <option value="Private">Privado — só as minhas doações</option>
            <option value="Public">Público — toda a comunidade</option>
          </Select>
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600, color: 'var(--danger-500)' }}>Eliminar conta</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Elimina permanentemente o seu perfil, contactos e acesso à sua conta Wafina. O seu
            histórico de doações já entregues pode ser mantido de forma anonimizada para
            estatísticas de impacto agregadas — sem qualquer dado que o identifique. Esta ação não
            pode ser revertida.
          </p>
          {!showDeleteConfirm ? (
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Eliminar a minha conta
            </Button>
          ) : (
            <div className="stack">
              <Input
                label={`Escreva "${session.email}" para confirmar`}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              />
              {deleteError && <div className="banner banner-error">{deleteError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="danger"
                  disabled={deleting || deleteConfirmEmail.trim().toLowerCase() !== session.email.toLowerCase()}
                  onClick={onDeleteAccount}
                >
                  {deleting ? 'A eliminar…' : 'Confirmar eliminação'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmEmail('');
                    setDeleteError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>

        {IS_DEV_BUILD && (
          <Card className="stack">
            <p style={{ fontWeight: 600 }}>Opções de programador</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
              Simula o país detetado por GPS, sem precisar de VPN ou de uma app de localização falsa.
              Nunca aparece fora de um build de desenvolvimento.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SIMULATABLE_COUNTRIES.map((c) => (
                <Button
                  key={c.isoCode}
                  variant="secondary"
                  onClick={() => simulateCountryDetection(c.isoCode)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
