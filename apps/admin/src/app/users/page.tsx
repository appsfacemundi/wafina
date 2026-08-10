'use client';

import type { GeoRegion, RegistrableRole, User } from '@wafina/shared';
import { Badge, Button, Card, CollapsibleGroup, EmptyState, Input, useToast } from '@wafina/ui';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { firebaseAuth } from '@/lib/firebase';
import { ApiError, apiFetch } from '@/lib/api';

const ROLE_LABEL: Record<string, string> = {
  Donor: 'Doador',
  Institution: 'Instituição',
  Admin: 'Admin',
  Animal_Shelter: 'Abrigo de Animais',
};

export default function AdminUsersPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [userList, countryList] = await Promise.all([
        apiFetch<User[]>('/admin/users', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setUsers(userList);
      setCountries(countryList);
    } catch {
      setError('Não foi possível carregar os utilizadores.');
    }
  }

  function countryName(countryId: string): string {
    return countries.find((c) => c.Region_ID === countryId)?.Name ?? countryId;
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    const matching = q
      ? users.filter((u) => u.Name.toLowerCase().includes(q) || u.Email.toLowerCase().includes(q))
      : users;
    // Real-device finding, 2026-08-04: previously sorted by join date. Blank
    // names (between account creation and profile completion) sort to the
    // bottom rather than interleaving alphabetically ahead of real names.
    return [...matching].sort((a, b) => {
      if (!a.Name.trim() && !b.Name.trim()) return 0;
      if (!a.Name.trim()) return 1;
      if (!b.Name.trim()) return -1;
      return a.Name.localeCompare(b.Name);
    });
  }, [users, search]);

  // Admin UX consistency pass, 2026-08-08 — same collapsible grouping as
  // Donations/Institutions, so a large user base doesn't bury Institution
  // and Admin accounts among a long alphabetical list of Donors.
  const groups = useMemo(() => {
    if (!filtered) return [];
    return [
      { key: 'donor', title: 'Doadores', items: filtered.filter((u) => u.Role === 'Donor') },
      { key: 'institution', title: 'Instituições', items: filtered.filter((u) => u.Role === 'Institution') },
      { key: 'admin', title: 'Admins', items: filtered.filter((u) => u.Role === 'Admin') },
    ];
  }, [filtered]);

  async function onSuspend(userId: string) {
    setError('');
    setBusyId(userId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/users/${userId}/suspend`, { method: 'POST', idToken });
      await load();
      showToast('Conta suspensa.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível suspender a conta.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(userId: string) {
    setError('');
    setBusyId(userId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/users/${userId}/reactivate`, { method: 'POST', idToken });
      await load();
      showToast('Conta reativada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reativar a conta.');
    } finally {
      setBusyId(null);
    }
  }

  async function onChangeRole(userId: string, role: RegistrableRole) {
    setError('');
    setBusyId(userId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/users/${userId}/role`, { method: 'POST', idToken, body: { role } });
      await load();
      showToast('Tipo de conta atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o tipo de conta.');
    } finally {
      setBusyId(null);
    }
  }

  async function onResetPassword(email: string) {
    setError('');
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      showToast(`Email de redefinição de password enviado para ${email}.`);
    } catch {
      setError('Não foi possível enviar o email de redefinição de password.');
    }
  }

  function renderUserCard(u: User) {
    return (
      <Card key={u.User_ID} className="stack" style={{ gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{u.Name || '(sem nome)'}</p>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{u.Email}</p>
          </div>
          <Badge tone={u.Status === 'Suspended' ? 'warning' : 'success'}>
            {u.Status === 'Suspended' ? 'Suspensa' : 'Ativa'}
          </Badge>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          {ROLE_LABEL[u.Role] ?? u.Role}
          {u.Donor_Subtype === 'Corporate' ? ' · Corporativo' : ''}
          {u.Home_Country_ID ? ` · ${countryName(u.Home_Country_ID)}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {u.Status === 'Suspended' ? (
            <Button onClick={() => onReactivate(u.User_ID)} disabled={busyId === u.User_ID}>
              Reativar
            </Button>
          ) : (
            <Button variant="danger" onClick={() => onSuspend(u.User_ID)} disabled={busyId === u.User_ID}>
              Suspender
            </Button>
          )}
          {u.Role !== 'Admin' && (
            <Button
              variant="secondary"
              onClick={() => onChangeRole(u.User_ID, u.Role === 'Donor' ? 'Institution' : 'Donor')}
              disabled={busyId === u.User_ID}
            >
              Mudar para {u.Role === 'Donor' ? 'Instituição' : 'Doador'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onResetPassword(u.Email)}>
            Redefinir password
          </Button>
        </div>
      </Card>
    );
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Utilizadores</h1>
        <Input
          label="Procurar por nome ou email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && <div className="banner banner-error">{error}</div>}
        {filtered === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {filtered?.length === 0 && (
          <EmptyState title="Sem resultados" description="Nenhum utilizador corresponde à pesquisa." icon="users" />
        )}
        {filtered && filtered.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <CollapsibleGroup key={group.key} title={group.title} count={group.items.length}>
                  {group.items.map((u) => renderUserCard(u))}
                </CollapsibleGroup>
              ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
