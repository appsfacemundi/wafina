import { useId, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Donate screen redesign, 2026-08-07 — lets a numbered section header stand in for the label instead of showing it twice. */
  hideLabel?: boolean;
}

export function Select({ label, hint, error, hideLabel, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="field">
      {!hideLabel && <label htmlFor={selectId}>{label}</label>}
      <select
        id={selectId}
        className={['input', error ? 'is-error' : '', className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
