'use client';

import { DONATION_STATUS_LABEL, type GeoRegion } from '@wafina/shared';
import { Button, Card, EmptyState, Select } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
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

const ROLE_LABEL: Record<string, string> = { Donor: 'Doador', Institution: 'Instituição', Admin: 'Admin' };

type ReportRow = Record<string, unknown>;
type Column = { label: string; get: (row: ReportRow, countryName: (id: string) => string) => string };

/** Real-device finding, 2026-08-04: the export used to dump every internal
 * field (IDs, raw booleans, nested objects) with no labels or chosen order —
 * technically complete, not actually readable. One curated column set per
 * report type, in the order a human would actually want to scan them. */
const REPORT_COLUMNS: Record<string, Column[]> = {
  donations: [
    { label: 'Código', get: (r) => String(r.Public_Donation_Code ?? '') },
    { label: 'Item', get: (r) => String(r.Item_Type ?? '') },
    { label: 'Quantidade', get: (r) => String(r.Quantity ?? '') },
    { label: 'Estado do item', get: (r) => String(r.Condition ?? '') },
    {
      label: 'Estado da doação',
      get: (r) => DONATION_STATUS_LABEL[r.Status as keyof typeof DONATION_STATUS_LABEL] ?? String(r.Status ?? ''),
    },
    { label: 'Doador', get: (r) => String(r.Donor_Display_Name ?? r.Donor_ID ?? '') },
    { label: 'Instituição', get: (r) => String(r.Claimed_By_Institution_Name ?? '—') },
    { label: 'País', get: (r, countryName) => countryName(String(r.Country_ID ?? '')) },
    { label: 'Cidade', get: (r) => String(r.City ?? '') },
    { label: 'Data de submissão', get: (r) => String(r.Date_Submitted ?? '').slice(0, 10) },
    { label: 'Data de entrega', get: (r) => String(r.Date_Delivered ?? '').slice(0, 10) },
  ],
  institutions: [
    { label: 'Nome', get: (r) => String(r.Name ?? '') },
    { label: 'Tipo', get: (r) => String(r.Type ?? '') },
    { label: 'País', get: (r, countryName) => countryName(String(r.Country_ID ?? '')) },
    {
      label: 'Estado',
      get: (r) => (r.Verified ? 'Verificada' : r.Rejection_Reason ? 'Rejeitada' : 'Pendente'),
    },
    { label: 'Itens recebidos', get: (r) => String(r.Total_Items_Received ?? 0) },
  ],
  companies: [
    { label: 'Nome', get: (r) => String(r.Company_Name ?? '') },
    { label: 'País', get: (r) => String(r.Country ?? '') },
    { label: 'Estado', get: (r) => (r.Status === 'Suspended' ? 'Suspensa' : 'Ativa') },
    { label: 'Colaboradores', get: (r) => String(r.Employee_Count ?? 0) },
    { label: 'Doações', get: (r) => String(r.Donation_Count ?? 0) },
  ],
  users: [
    { label: 'Nome', get: (r) => String(r.Name ?? '(sem nome)') },
    { label: 'Email', get: (r) => String(r.Email ?? '') },
    { label: 'Tipo de conta', get: (r) => ROLE_LABEL[String(r.Role)] ?? String(r.Role ?? '') },
    { label: 'Estado', get: (r) => (r.Status === 'Suspended' ? 'Suspensa' : 'Ativa') },
    { label: 'País de origem', get: (r, countryName) => countryName(String(r.Home_Country_ID ?? '')) },
    { label: 'Data de registo', get: (r) => String(r.Date_Joined ?? '').slice(0, 10) },
  ],
  countries: [
    { label: 'Nome', get: (r) => String(r.Name ?? '') },
    { label: 'Código ISO', get: (r) => String(r.ISO_Code ?? '') },
    { label: 'Ativo', get: (r) => (r.Active ? 'Sim' : 'Não') },
  ],
  'success-stories': [
    { label: 'Título', get: (r) => String(r.Title ?? '') },
    { label: 'Instituição', get: (r) => String(r.Institution_Name ?? '') },
    { label: 'Estado', get: (r) => String(r.Status ?? '') },
    { label: 'Data de publicação', get: (r) => String(r.Date_Published ?? '').slice(0, 10) },
  ],
};

/**
 * CSV/formula injection guard: a cell whose text starts with =, +, -, @, tab,
 * or CR would be interpreted as a formula by Excel/Sheets on open (e.g. a
 * Company Name of `=HYPERLINK("http://evil","click")`). Since every column
 * here ultimately comes from user-entered data (institution names, reasons,
 * descriptions...), prefixing a leading apostrophe neutralizes it as a
 * formula trigger while leaving the visible text unchanged for a human
 * reader — the standard OWASP mitigation for this class of export.
 */
function escapeFormulaTrigger(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function toCsv(columns: Column[], rows: ReportRow[], countryName: (id: string) => string): string {
  if (rows.length === 0) return '';
  const escape = (value: string) => `"${escapeFormulaTrigger(value).replace(/"/g, '""')}"`;
  const lines = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escape(c.get(row, countryName))).join(',')),
  ];
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
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');

  async function load() {
    if (!firebaseUser) return;
    setRows(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const [reportRows, countryList] = await Promise.all([
        apiFetch<ReportRow[]>(`/admin/reports/${type}`, { idToken }),
        countries.length ? Promise.resolve(countries) : apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setRows(reportRows);
      setCountries(countryList);
    } catch {
      setError('Não foi possível carregar o relatório.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser, type]);

  const countryName = useMemo(() => {
    const byId = new Map(countries.map((c) => [c.Region_ID, c.Name]));
    return (id: string) => byId.get(id) ?? id;
  }, [countries]);

  const columns = REPORT_COLUMNS[type] ?? [];

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
            onClick={() => downloadCsv(`wafina-${type}.csv`, toCsv(columns, rows ?? [], countryName))}
          >
            Exportar CSV
          </Button>
        </div>

        {rows === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {rows?.length === 0 && <EmptyState title="Sem dados" description="Não há registos para este relatório." />}
        {rows && rows.length > 0 && (
          <Card style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.label}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td
                        key={col.label}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.get(row, countryName)}
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
