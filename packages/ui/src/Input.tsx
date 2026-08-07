import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Donate screen redesign, 2026-08-07 — lets a numbered section header stand in for the label instead of showing it twice. */
  hideLabel?: boolean;
}

export function Input({ label, hint, error, hideLabel, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="field">
      {!hideLabel && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className={['input', error ? 'is-error' : '', className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
