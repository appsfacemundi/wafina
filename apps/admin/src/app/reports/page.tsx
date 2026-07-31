'use client';

import { Button, Card, EmptyState, Select } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

const REPORT_TYPES = [
  { label: 'Doações', value: 'donations' },
  { label: 'Instituições', value: 'institutions' },
  { label: 'Empresas', value: 'companies' },
  { label: 'Utilizadores', value: 'users' },
  { label: 'Países', value: 'countries' },
  { label: 'Histórias de Impacto', value: 'success-stories' },
];

type ReportRow = Record<string, unknown>;

/** Some report columns (e.g. a donation's Location) are objects, not scalars — JSON.stringify beats the default `[object Object]` from a bare String() call, both on screen and in the CSV export. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${cellText(value).replace(/"/g, '""')}"`;
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => escape(row[c])).join(','))];
  return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();

  const [type, setType] = useState('donations');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    if (!firebaseUser) return;
    setRows(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      setRows(await apiFetch<ReportRow[]>(`/admin/reports/${type}`, { idToken }));
    } catch {
      setError('Não foi possível carregar o relatório.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser, type]);

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Relatórios</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Select label="Tipo de relatório" value={type} onChange={(e) => setType(e.target.value)}>
            {REPORT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!rows || rows.length === 0}
            onClick={() => downloadCsv(`wafina-${type}.csv`, toCsv(rows ?? []))}
          >
            Exportar CSV
          </Button>
        </div>

        {rows === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {rows?.length === 0 && <EmptyState title="Sem dados" description="Não há registos para este relatório." />}
        {rows && rows.length > 0 && (
          <Card style={{ padding: 0, overflow: 'auto' }}>
            <table className="mono" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cellText(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
