'use client';

import { formatDateTimeLabel, type SuccessStory } from '@wafina/shared';
import { Card, EmptyState } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * Institution App Polish QA review (2026-07-31) — a dedicated Impact section
 * had been missing; donors could only see a story mentioned inline on the
 * one donation card it belonged to. This is the same data
 * (listSuccessStoriesByDonor, Approved-only) as a proper standalone page.
 */
export default function ImpactPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setStories(await apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as histórias de impacto.');
      }
    })();
  }, [firebaseUser]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Histórias de Impacto</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Veja o impacto real das suas doações, partilhado pelas instituições que as receberam.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && stories === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {stories?.length === 0 && (
          <EmptyState
            title="Ainda sem histórias"
            description="Quando uma instituição partilhar o impacto de uma das suas doações, aparece aqui."
          />
        )}
        {stories && stories.length > 0 && (
          <div className="stack">
            {stories.map((story) => (
              <Card key={story.Success_Story_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={story.Image}
                  alt=""
                  style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                />
                <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 18 }}>{story.Title}</p>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{story.Description}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    Publicada em {formatDateTimeLabel(story.Date_Published)}
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
