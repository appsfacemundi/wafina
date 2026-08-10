'use client';

import type { AdminSuccessStoryView } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminSuccessStoriesPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [stories, setStories] = useState<AdminSuccessStoryView[] | null>(null);
  const [published, setPublished] = useState<AdminSuccessStoryView[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [pending, live] = await Promise.all([
        apiFetch<AdminSuccessStoryView[]>('/admin/success-stories/pending', { idToken }),
        apiFetch<AdminSuccessStoryView[]>('/admin/success-stories/published', { idToken }),
      ]);
      setStories(pending);
      setPublished(live);
    } catch {
      setError('Não foi possível carregar as histórias.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onApprove(storyId: string) {
    setError('');
    setBusyId(storyId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/success-stories/${storyId}/approve`, { method: 'POST', idToken });
      await load();
      showToast('História aprovada — já está visível ao doador.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aprovar a história.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(storyId: string) {
    if (!rejectReason.trim()) {
      setError('Indique o motivo da rejeição.');
      return;
    }
    setError('');
    setBusyId(storyId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/success-stories/${storyId}/reject`, {
        method: 'POST',
        idToken,
        body: { reason: rejectReason },
      });
      setRejectingId(null);
      setRejectReason('');
      await load();
      showToast('História rejeitada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível rejeitar a história.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReplacePhoto(storyId: string, file: File) {
    setError('');
    setPhotoSavingId(storyId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('image', file);
      await apiFetch(`/admin/success-stories/${storyId}/photo`, { method: 'PATCH', idToken, body: form });
      await load();
      showToast('Fotografia substituída.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível substituir a fotografia.');
    } finally {
      setPhotoSavingId(null);
    }
  }

  async function onRemove(storyId: string) {
    if (!removeReason.trim()) {
      setError('Indique o motivo da remoção.');
      return;
    }
    setError('');
    setBusyId(storyId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/success-stories/${storyId}/remove`, {
        method: 'POST',
        idToken,
        body: { reason: removeReason },
      });
      setRemovingId(null);
      setRemoveReason('');
      await load();
      showToast('História removida da Feed de Impacto.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover a história.');
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Histórias de Impacto</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <div className="stack">
          <h2 style={{ fontSize: 17 }}>Pendentes</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Nada publica automaticamente. Só depois de aprovada uma história fica visível ao doador.
          </p>
          {stories === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
          {stories?.length === 0 && (
            <EmptyState
              title="Sem histórias pendentes"
              description="Quando uma instituição publicar uma história, aparece aqui para revisão."
              icon="heart"
            />
          )}
          {stories && stories.length > 0 && (
            <div className="stack">
              {stories.map((story) => (
                <Card key={story.Success_Story_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                  <img src={story.Image} alt="" style={{
                      width: '100%',
                      height: 180,
                      objectFit: 'contain',
                      display: 'block',
                      background: 'var(--color-surface-2)',
                    }} />
                  <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{story.Title}</p>
                    {story.Institution_Name && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Photo
                          src={story.Institution_Logo}
                          placeholderIcon="🏢"
                          style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                        />
                        {story.Institution_Name}
                      </p>
                    )}
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{story.Description}</p>

                    {rejectingId === story.Success_Story_ID ? (
                      <div className="stack">
                        <Input label="Motivo da rejeição" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="danger" onClick={() => onReject(story.Success_Story_ID)} disabled={busyId === story.Success_Story_ID}>
                            Confirmar rejeição
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <Button onClick={() => onApprove(story.Success_Story_ID)} disabled={busyId === story.Success_Story_ID}>
                          {busyId === story.Success_Story_ID ? 'A aprovar…' : 'Aprovar'}
                        </Button>
                        <Button variant="danger" onClick={() => setRejectingId(story.Success_Story_ID)} disabled={busyId === story.Success_Story_ID}>
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 17 }}>Publicadas na Feed</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Toda a história atualmente visível na Feed de Impacto, publicada por uma instituição ou diretamente pelo
            Admin. Pode substituir a fotografia ou remover a história da Feed a qualquer momento.
          </p>
          {published === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
          {published?.length === 0 && (
            <EmptyState title="Sem histórias publicadas" description="Histórias aprovadas aparecem aqui." icon="heart" />
          )}
          {published && published.length > 0 && (
            <div className="stack">
              {published.map((story) => (
                <Card key={story.Success_Story_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <img src={story.Image} alt="" style={{
                      width: '100%',
                      height: 180,
                      objectFit: 'contain',
                      display: 'block',
                      background: 'var(--color-surface-2)',
                    }} />
                    <label
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 999,
                        cursor: photoSavingId === story.Success_Story_ID ? 'default' : 'pointer',
                        opacity: photoSavingId === story.Success_Story_ID ? 0.6 : 1,
                      }}
                    >
                      {photoSavingId === story.Success_Story_ID ? 'A enviar…' : 'Substituir foto'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={photoSavingId === story.Success_Story_ID}
                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) onReplacePhoto(story.Success_Story_ID, file);
                        }}
                      />
                    </label>
                  </div>
                  <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{story.Title}</p>
                    {story.Institution_Name && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Photo
                          src={story.Institution_Logo}
                          placeholderIcon="🏢"
                          style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                        />
                        {story.Institution_Name}
                      </p>
                    )}
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{story.Description}</p>

                    {removingId === story.Success_Story_ID ? (
                      <div className="stack">
                        <Input label="Motivo da remoção" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="danger" onClick={() => onRemove(story.Success_Story_ID)} disabled={busyId === story.Success_Story_ID}>
                            Confirmar remoção
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRemovingId(null);
                              setRemoveReason('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        <Button variant="danger" onClick={() => setRemovingId(story.Success_Story_ID)} disabled={busyId === story.Success_Story_ID}>
                          Remover da Feed
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
