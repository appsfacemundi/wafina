'use client';

import type { AdminCorporateAccountView, InvitationCode } from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Input, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminCompaniesPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [companies, setCompanies] = useState<AdminCorporateAccountView[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');

  const [codesById, setCodesById] = useState<Record<string, InvitationCode[]>>({});
  const [managingCodesId, setManagingCodesId] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setCompanies(await apiFetch<AdminCorporateAccountView[]>('/admin/corporate-accounts', { idToken }));
    } catch {
      setError('Não foi possível carregar as empresas.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onCreate() {
    if (!companyName.trim() || !country.trim()) {
      setError('Indique o nome da empresa e o país.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/admin/corporate-accounts', {
        method: 'POST',
        idToken,
        body: { companyName, country },
      });
      setCompanyName('');
      setCountry('');
      await load();
      showToast('Empresa criada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a empresa.');
    } finally {
      setCreating(false);
    }
  }

  async function onSaveEdit(id: string) {
    setError('');
    setBusyId(id);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/corporate-accounts/${id}`, {
        method: 'PATCH',
        idToken,
        body: { Company_Name: editName, Country: editCountry },
      });
      setEditingId(null);
      await load();
      showToast('Empresa atualizada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a empresa.');
    } finally {
      setBusyId(null);
    }
  }

  async function onSuspend(id: string) {
    setError('');
    setBusyId(id);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/corporate-accounts/${id}/suspend`, { method: 'POST', idToken });
      await load();
      showToast('Empresa suspensa.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível suspender a empresa.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(id: string) {
    setError('');
    setBusyId(id);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/corporate-accounts/${id}/reactivate`, { method: 'POST', idToken });
      await load();
      showToast('Empresa reativada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reativar a empresa.');
    } finally {
      setBusyId(null);
    }
  }

  async function loadCodes(id: string) {
    try {
      const idToken = await firebaseUser?.getIdToken();
      const codes = await apiFetch<InvitationCode[]>(`/admin/corporate-accounts/${id}/codes`, { idToken });
      setCodesById((prev) => ({ ...prev, [id]: codes }));
    } catch {
      setError('Não foi possível carregar os códigos de convite.');
    }
  }

  async function onManageCodes(id: string) {
    setManagingCodesId(id);
    await loadCodes(id);
  }

  async function onGenerateCode(id: string) {
    const uses = Number(maxUses);
    if (!Number.isInteger(uses) || uses < 1) {
      setError('Indique um número de utilizações válido.');
      return;
    }
    setError('');
    setBusyId(id);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/corporate-accounts/${id}/codes`, {
        method: 'POST',
        idToken,
        body: { maxUses: uses, expiresAt: expiresAt || null },
      });
      setMaxUses('1');
      setExpiresAt('');
      await loadCodes(id);
      showToast('Código de convite gerado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o código.');
    } finally {
      setBusyId(null);
    }
  }

  async function onDeactivateCode(id: string, code: string) {
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/invitation-codes/${code}/deactivate`, { method: 'POST', idToken });
      await loadCodes(id);
      showToast('Código desativado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível desativar o código.');
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Empresas</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <Card className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Adicionar empresa</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input label="Nome da empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} />
            <Button onClick={onCreate} disabled={creating}>
              {creating ? 'A criar…' : 'Criar'}
            </Button>
          </div>
        </Card>

        {companies === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {companies?.length === 0 && (
          <EmptyState title="Sem empresas" description="As empresas parceiras aparecem aqui depois de criadas." />
        )}
        {companies && companies.length > 0 && (
          <div className="stack">
            {companies.map((c) => (
              <Card key={c.Corporate_Account_ID} className="stack" style={{ gap: 6 }}>
                {editingId === c.Corporate_Account_ID ? (
                  <div className="stack">
                    <Input label="Nome da empresa" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <Input label="País" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={() => onSaveEdit(c.Corporate_Account_ID)} disabled={busyId === c.Corporate_Account_ID}>
                        Guardar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{c.Company_Name}</p>
                        <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{c.Country}</p>
                      </div>
                      <Badge tone={c.Status === 'Suspended' ? 'warning' : 'success'}>
                        {c.Status === 'Suspended' ? 'Suspensa' : 'Ativa'}
                      </Badge>
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      {c.Employee_Count} colaborador{c.Employee_Count === 1 ? '' : 'es'} · {c.Donation_Count} doações
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(c.Corporate_Account_ID);
                          setEditName(c.Company_Name);
                          setEditCountry(c.Country);
                        }}
                      >
                        Editar
                      </Button>
                      {c.Status === 'Suspended' ? (
                        <Button onClick={() => onReactivate(c.Corporate_Account_ID)} disabled={busyId === c.Corporate_Account_ID}>
                          Reativar
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => onSuspend(c.Corporate_Account_ID)}
                          disabled={busyId === c.Corporate_Account_ID}
                        >
                          Suspender
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => onManageCodes(c.Corporate_Account_ID)}>
                        Códigos de convite
                      </Button>
                    </div>
                  </>
                )}

                {managingCodesId === c.Corporate_Account_ID && (
                  <div
                    className="stack"
                    style={{ marginTop: 8, padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 13.5 }}>Códigos de convite</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <Input
                        label="Utilizações máximas"
                        hint="1 = uso único"
                        type="number"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                      />
                      <Input
                        label="Expira em (opcional)"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                      />
                      <Button onClick={() => onGenerateCode(c.Corporate_Account_ID)} disabled={busyId === c.Corporate_Account_ID}>
                        Gerar código
                      </Button>
                    </div>
                    {(codesById[c.Corporate_Account_ID] ?? []).map((code) => (
                      <div
                        key={code.Code}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                      >
                        <div>
                          <p className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                            {code.Code}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                            {code.Uses_Count}/{code.Max_Uses} utilizações
                            {code.Expires_At ? ` · expira ${code.Expires_At.slice(0, 10)}` : ''}
                            {!code.Active ? ' · desativado' : ''}
                          </p>
                        </div>
                        {code.Active && (
                          <Button variant="ghost" onClick={() => onDeactivateCode(c.Corporate_Account_ID, code.Code)}>
                            Desativar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
