import type { HTMLAttributes } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: Tone;
}

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={['badge', `badge-${tone}`, className].filter(Boolean).join(' ')} {...props} />;
}
