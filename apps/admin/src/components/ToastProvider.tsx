'use client';

import { ToastProvider as SharedToastProvider } from '@wafina/ui';

/**
 * Thin re-export so this file (compiled fresh from source by Next's own
 * SWC, with 'use client' intact as the literal first line) is the client
 * boundary — not packages/ui's tsc-built dist, where "use strict" ends up
 * emitted before 'use client' and Next fails to recognize the directive
 * when the component is used directly inside a Server Component (layout.tsx).
 * Same fix as apps/institution/src/components/ToastProvider.tsx.
 */
export const ToastProvider = SharedToastProvider;
