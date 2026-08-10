'use client';

import { formatDateTimeLabel, type SuccessStory } from '@wafina/shared';
import { Card, EmptyState, Icon, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * Bug fix, 2026-08-08 — Web had no sharing affordance at all on Impact
 * stories (mobile has one via the native share sheet). `navigator.share` is
 * only available on secure contexts/some browsers, so this always falls back
 * to a clipboard copy — either way the user gets guaranteed visible feedback
 * via a toast, matching the pattern already used for the "Seja Parceiro" CTA.
 *
 * Follow-up, 2026-08-08 — the first version only ever shared text, never the
 * photo itself. The Web Share API (Level 2) supports sharing actual files via
 * `navigator.share({ files })`, gated by `navigator.canShare` support — fetch
 * the image (same API origin as everything else, already covered by the
 * existing CORS policy) and share it as a real file when supported, falling
 * back to text-only share, then to clipboard, so the click always does
 * something even on a browser with no file-sharing support at all.
 */
async function shareStory(story: SuccessStory, showToast: (message: string) => void) {
  const text = `${story.Title}\n\n${story.Description}\n\n— partilhado via Wafina`;
  const title = `Wafina — ${story.Title}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    let file: File | null = null;
    try {
      const res = await fetch(story.Image);
      const blob = await res.blob();
      file = new File([blob], 'wafina-historia.jpg', { type: blob.type || 'image/jpeg' });
    } catch {
      // Image fetch failed (offline, CORS on a non-default origin, etc.) —
      // fall through and still try a text-only share below.
    }

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
      } else {
        await navigator.share({ title, text });
      }
      return;
    } catch (err) {
      // AbortError means the user closed the share sheet themselves — respect
      // that silently. Anything else is a real failure, fall through to the
      // clipboard-copy fallback below so the click still does something.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Texto da história copiado — cole onde quiser partilhar.');
  } catch {
    showToast('Não foi possível partilhar automaticamente. Copie o texto manualmente.');
  }
}

/**
 * Institution App Polish QA review (2026-07-31) — a dedicated Impact section
 * had been missing; donors could only see a story mentioned inline on the
 * one donation card it belonged to. This is the same data
 * (listSuccessStoriesByDonor, Approved-only) as a proper standalone page.
 */
export default function ImpactPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
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
                  style={{
                    width: '100%',
                    height: 220,
                    objectFit: 'contain',
                    display: 'block',
                    background: 'var(--color-surface-2)',
                  }}
                />
                <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 18 }}>{story.Title}</p>
                    <button
                      type="button"
                      onClick={() => shareStory(story, showToast)}
                      aria-label="Partilhar história"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--color-text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="share" size={18} />
                    </button>
                  </div>
                  {(story.Institution_Name || story.Item_Type) && (
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent)' }}>
                      {[story.Item_Type, story.Institution_Name].filter(Boolean).join(' · ')}
                    </p>
                  )}
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
