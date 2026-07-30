'use client';

import { Button, Card, Input } from '@wafina/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 600;

export default function NewSuccessStoryPage() {
  return (
    <Suspense fallback={null}>
      <NewSuccessStoryForm />
    </Suspense>
  );
}

function NewSuccessStoryForm() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const donationId = searchParams.get('donationId') ?? '';
  const code = searchParams.get('code') ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function onImageChange(file: File | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    setImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Indique um título.');
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      setError(`O título não pode exceder ${MAX_TITLE_LENGTH} caracteres.`);
      return;
    }
    if (!description.trim()) {
      setError('Indique uma descrição.');
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`A descrição não pode exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    if (!image) {
      setError('Adicione uma fotografia.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('Donation_ID', donationId);
      form.append('Title', title);
      form.append('Description', description);
      form.append('image', image);

      await apiFetch('/success-stories', { method: 'POST', idToken, body: form });
      router.push('/donations/claimed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar a história.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Publicar história de impacto</h1>
        <Card>
          <form onSubmit={onSubmit} className="stack">
            {code && (
              <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                Doação: {code}
              </p>
            )}
            <Input
              label="Título"
              required
              value={title}
              hint={`${title.length}/${MAX_TITLE_LENGTH}`}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="field">
              <label htmlFor="description-input">Descrição</label>
              <textarea
                id="description-input"
                className="input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="hint">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <div className="field">
              <label htmlFor="image-input">Fotografia</label>
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Pré-visualização"
                  style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }}
                />
              ) : (
                <div className="upload-well">Escolha uma fotografia</div>
              )}
              <input
                id="image-input"
                type="file"
                accept="image/*"
                onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
              />
            </div>
            {error && <div className="banner banner-error">{error}</div>}
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'A publicar…' : 'Publicar'}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
