'use client';

import type { Partner } from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

interface PartnerDraft {
  Name: string;
  Description: string;
  Website: string;
  Display_Order: string;
}

function toDraft(p: Partner): PartnerDraft {
  return { Name: p.Name, Description: p.Description, Website: p.Website ?? '', Display_Order: String(p.Display_Order) };
}

export default function AdminPartnersPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PartnerDraft>>({});
  const [pendingLogoFiles, setPendingLogoFiles] = useState<Record<string, File | null>>({});

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const list = await apiFetch<Partner[]>('/admin/partners', { idToken });
      setPartners(list);
      setDrafts(Object.fromEntries(list.map((p) => [p.Partner_ID, toDraft(p)])));
    } catch {
      setError('Não foi possível carregar os parceiros.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onCreate() {
    if (!newName.trim() || !newDescription.trim()) {
      setError('Indique o nome e a descrição do parceiro.');
      return;
    }
    if (!newLogo) {
      setError('Escolha um logótipo.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('logo', newLogo);
      form.append('Name', newName.trim());
      form.append('Description', newDescription.trim());
      if (newWebsite.trim()) form.append('Website', newWebsite.trim());
      await apiFetch('/admin/partners', { method: 'POST', idToken, body: form });
      setNewName('');
      setNewDescription('');
      setNewWebsite('');
      setNewLogo(null);
      await load();
      showToast('Parceiro adicionado — já visível na Home do doador.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o parceiro.');
    } finally {
      setCreating(false);
    }
  }

  async function onSaveEdit(partnerId: string, logoFile: File | null) {
    const draft = drafts[partnerId];
    if (!draft?.Name.trim() || !draft.Description.trim()) {
      setError('Indique o nome e a descrição do parceiro.');
      return;
    }
    setError('');
    setBusyId(partnerId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('Name', draft.Name.trim());
      form.append('Description', draft.Description.trim());
      form.append('Website', draft.Website.trim());
      form.append('Display_Order', String(Number(draft.Display_Order) || 0));
      if (logoFile) form.append('logo', logoFile);
      await apiFetch(`/admin/partners/${partnerId}`, { method: 'PATCH', idToken, body: form });
      setEditingId(null);
      await load();
      showToast('Parceiro atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o parceiro.');
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleActive(partnerId: string, active: boolean) {
    setError('');
    setBusyId(partnerId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/partners/${partnerId}/active`, { method: 'PATCH', idToken, body: { active } });
      await load();
      showToast(active ? 'Parceiro ativado.' : 'Parceiro desativado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o parceiro.');
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Parceiros</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Geridos aqui aparecem na secção "Os Nossos Parceiros" da Home do doador (web e mobile). Desativar um
          parceiro remove-o da Home sem perder o seu perfil.
        </p>
        {error && <div className="banner banner-error">{error}</div>}

        <Card className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Adicionar parceiro</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input label="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ minWidth: 200 }} />
            <Input
              label="Website (opcional)"
              placeholder="https://…"
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <div className="field">
              <label>Logótipo</label>
              <input type="file" accept="image/*" onChange={(e) => setNewLogo(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-partner-description">Descrição</label>
            <textarea
              id="new-partner-description"
              className="input"
              rows={3}
              style={{ resize: 'vertical' }}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <Button onClick={onCreate} disabled={creating}>
              {creating ? 'A adicionar…' : 'Adicionar parceiro'}
            </Button>
          </div>
        </Card>

        {partners === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {partners?.length === 0 && (
          <EmptyState
            title="Sem parceiros"
            description="Adicione o primeiro parceiro acima — 3 a 5 é um bom ponto de partida."
            icon="briefcase"
          />
        )}
        {partners && partners.length > 0 && (
          <div className="stack">
            {partners.map((p) => {
              const draft = drafts[p.Partner_ID] ?? toDraft(p);
              const isEditing = editingId === p.Partner_ID;
              return (
                <Card key={p.Partner_ID} className="stack" style={{ gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Photo
                        src={p.Logo}
                        placeholderIcon="🤝"
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'contain', background: 'var(--color-surface-muted, #f4f4f5)' }}
                      />
                      {!isEditing && (
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 15 }}>{p.Name}</p>
                          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 480 }}>{p.Description}</p>
                          {p.Website && (
                            <a href={p.Website} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--color-accent)', fontWeight: 600 }}>
                              {p.Website}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge tone={p.Active ? 'success' : 'neutral'}>{p.Active ? 'Ativo' : 'Inativo'}</Badge>
                  </div>

                  {isEditing && (
                    <div className="stack" style={{ gap: 8 }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Input
                          label="Nome"
                          value={draft.Name}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.Partner_ID]: { ...draft, Name: e.target.value } }))}
                        />
                        <Input
                          label="Website"
                          value={draft.Website}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.Partner_ID]: { ...draft, Website: e.target.value } }))}
                        />
                        <Input
                          label="Ordem"
                          type="number"
                          value={draft.Display_Order}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.Partner_ID]: { ...draft, Display_Order: e.target.value } }))}
                          style={{ maxWidth: 100 }}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`edit-desc-${p.Partner_ID}`}>Descrição</label>
                        <textarea
                          id={`edit-desc-${p.Partner_ID}`}
                          className="input"
                          rows={3}
                          style={{ resize: 'vertical' }}
                          value={draft.Description}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.Partner_ID]: { ...draft, Description: e.target.value } }))}
                        />
                      </div>
                      <div className="field">
                        <label>Substituir logótipo (opcional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPendingLogoFiles((prev) => ({ ...prev, [p.Partner_ID]: file }));
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <>
                        <Button
                          onClick={() => onSaveEdit(p.Partner_ID, pendingLogoFiles[p.Partner_ID] ?? null)}
                          disabled={busyId === p.Partner_ID}
                        >
                          {busyId === p.Partner_ID ? 'A guardar…' : 'Guardar'}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busyId === p.Partner_ID}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => setEditingId(p.Partner_ID)}>
                        Editar
                      </Button>
                    )}
                    {p.Active ? (
                      <Button variant="danger" onClick={() => onToggleActive(p.Partner_ID, false)} disabled={busyId === p.Partner_ID}>
                        Desativar
                      </Button>
                    ) : (
                      <Button onClick={() => onToggleActive(p.Partner_ID, true)} disabled={busyId === p.Partner_ID}>
                        Ativar
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
