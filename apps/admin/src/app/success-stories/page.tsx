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
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setStories(await apiFetch<AdminSuccessStoryView[]>('/admin/success-stories/pending', { idToken }));
    } catch {
      setError('Não foi possível carregar as histórias pendentes.');
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

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Histórias de Impacto Pendentes</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Nada publica automaticamente. Só depois de aprovada uma história fica visível ao doador.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
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
                <img
                  src={story.Image}
                  alt=""
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                />
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
                      <Input
                        label="Motivo da rejeição"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          variant="danger"
                          onClick={() => onReject(story.Success_Story_ID)}
                          disabled={busyId === story.Success_Story_ID}
                        >
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
                      <Button
                        variant="danger"
                        onClick={() => setRejectingId(story.Success_Story_ID)}
                        disabled={busyId === story.Success_Story_ID}
                      >
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
    </AppShell>
  );
}
