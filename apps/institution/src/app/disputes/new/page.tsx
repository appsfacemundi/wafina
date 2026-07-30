'use client';

import { Button, Card } from '@wafina/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useId, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

const MIN_LENGTH = 10;

export default function NewDisputePage() {
  return (
    <Suspense fallback={null}>
      <NewDisputeForm />
    </Suspense>
  );
}

function NewDisputeForm() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const donationId = searchParams.get('donationId') ?? '';
  const code = searchParams.get('code') ?? '';
  const fieldId = useId();

  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (description.trim().length < MIN_LENGTH) {
      setError(`Descreva a ocorrência com pelo menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/disputes', {
        method: 'POST',
        idToken,
        body: { Donation_ID: donationId, Issue_Description: description },
      });
      router.push('/disputes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a ocorrência.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Comunicar Ocorrência</h1>
        <Card className="stack">
          {code && (
            <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
              Doação: {code}
            </p>
          )}
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor={fieldId}>Descrição da ocorrência</label>
              <textarea
                id={fieldId}
                className="input"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <div className="banner banner-error">{error}</div>}
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'A enviar…' : 'Comunicar Ocorrência'}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
