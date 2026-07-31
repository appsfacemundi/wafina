import { useState, type CSSProperties } from 'react';

interface PhotoProps {
  src?: string | null;
  alt?: string;
  style?: CSSProperties;
  /** Emoji shown in the placeholder when there's no photo or it fails to load. Defaults to a camera. */
  placeholderIcon?: string;
}

/**
 * Institution UX follow-up (2026-07-31) — "never leave an empty space" when a
 * donation/institution/donor photo is missing, AND gracefully degrade if a
 * stored URL fails to load (found via a real bug: existing Drive URLs used a
 * format blocked by Cross-Origin-Resource-Policy — see config/drive.ts fix).
 * This component covers both cases in one place instead of repeating the
 * fallback logic at every call site.
 */
export function Photo({ src, alt = '', style, placeholderIcon = '📷' }: PhotoProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-faint)',
          fontSize: 24,
          ...style,
        }}
      >
        {placeholderIcon}
      </div>
    );
  }

  return <img src={src} alt={alt} style={style} onError={() => setErrored(true)} />;
}
