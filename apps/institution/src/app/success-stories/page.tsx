'use client';

import { formatDateTimeLabel, type SuccessStory, type SuccessStoryStatus } from '@wafina/shared';
import { Badge, Card, EmptyState } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

const STATUS_LABEL: Record<SuccessStoryStatus, string> = {
  Approved: 'Publicada',
  Pending: 'Pendente de aprovação',
  Rejected: 'Rejeitada',
};

const STATUS_TONE: Record<SuccessStoryStatus, 'success' | 'warning' | 'danger'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
};

type Filter = 'all' | SuccessStoryStatus;

export default function SuccessStoriesPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setStories(await apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as histórias.');
      }
    })();
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    if (!stories) return stories;
    if (filter === 'all') return stories;
    return stories.filter((s) => s.Status === filter);
  }, [stories, filter]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Histórias de Impacto</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'Approved', 'Pending', 'Rejected'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`app-nav-link${filter === f ? ' active' : ''}`}
              style={{ borderRadius: 999 }}
            >
              {f === 'all' ? 'Todas' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && stories === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {filtered?.length === 0 && (
          <EmptyState
            title="Sem histórias"
            description="Publique uma história de impacto a partir de uma doação entregue."
            icon="heart"
          />
        )}
        {filtered && filtered.length > 0 && (
          <div className="stack">
            {filtered.map((s) => (
              <Card key={s.Success_Story_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={s.Image}
                  alt=""
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                />
                <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{s.Title}</p>
                    <Badge tone={STATUS_TONE[s.Status]}>{STATUS_LABEL[s.Status]}</Badge>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{s.Description}</p>
                  {s.Status === 'Rejected' && s.Rejection_Reason && (
                    <p style={{ fontSize: 13, color: 'var(--danger-700)' }}>
                      Motivo da rejeição: {s.Rejection_Reason}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {s.Status === 'Approved' ? 'Publicada' : 'Enviada'} em {formatDateTimeLabel(s.Date_Published)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
