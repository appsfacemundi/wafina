import { useEffect, useState, type CSSProperties } from 'react';
import { Photo } from './Photo';

interface PhotoGalleryModalProps {
  open: boolean;
  photos: string[];
  onClose: () => void;
}

const navBtnBase: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.15)',
  border: 'none',
  color: '#ffffff',
  fontSize: 22,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * V2 multi-photo (2026-08-17) — full-size viewer for a donation's full
 * Photos array, opened by clicking the cover thumbnail on Admin's donation
 * card. Renders nothing when closed or empty, so callers can pass `open`
 * unconditionally. Escape closes it, matching standard modal/lightbox
 * behavior; arrow keys step through when there's more than one photo.
 */
export function PhotoGalleryModal({ open, photos, onClose }: PhotoGalleryModalProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, photos.length, onClose]);

  if (!open || photos.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 8, 10, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fechar"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          color: '#ffffff',
          fontSize: 20,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + photos.length) % photos.length);
          }}
          aria-label="Foto anterior"
          style={{ ...navBtnBase, left: 16 }}
        >
          ‹
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '80vw',
          maxHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Photo
          src={photos[index]}
          style={{ maxWidth: '80vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
        />
      </div>
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % photos.length);
          }}
          aria-label="Próxima foto"
          style={{ ...navBtnBase, right: 16 }}
        >
          ›
        </button>
      )}

      {photos.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 999,
            padding: '6px 14px',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {index + 1}/{photos.length}
        </div>
      )}
    </div>
  );
}
