import { useState, type ReactNode } from 'react';

interface CollapsibleGroupProps {
  title: string;
  count: number;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

/**
 * Admin UX consistency pass, 2026-08-08 — extracted from the Donations page's
 * Aceites/Pendentes/Entregue grouping (2026-08-07) so every long Admin list
 * (Institutions, Users, Companies, ...) gets the same fold/expand behavior
 * instead of each page hand-rolling its own version of this button.
 */
export function CollapsibleGroup({ title, count, defaultCollapsed = false, children }: CollapsibleGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          // Admin UX fix, 2026-08-08 — the fold state used to be indicated only
          // by a small rotated chevron, easy to miss when scanning several
          // groups at once. Expanded groups now get an accent-tinted
          // background/border so open vs. closed is obvious at a glance.
          background: collapsed ? 'var(--color-surface)' : 'var(--color-accent-soft)',
          border: `1px solid ${collapsed ? 'var(--color-border)' : 'var(--color-accent)'}`,
          borderRadius: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: collapsed ? 'var(--color-text-faint)' : 'var(--color-accent)',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
          }}
        >
          ▾
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: collapsed ? 'inherit' : 'var(--color-accent)' }}>
          {title}
        </h2>
        <span style={{ fontSize: 13, color: collapsed ? 'var(--color-text-faint)' : 'var(--color-accent)' }}>
          ({count})
        </span>
      </button>
      {!collapsed && <div className="stack">{children}</div>}
    </div>
  );
}
