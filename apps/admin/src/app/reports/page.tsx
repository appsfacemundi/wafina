'use client';

import {
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  DONATION_STATUS_LABEL,
  DONATION_STATUSES,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL,
  type DeliveryMethod,
  type GeoRegion,
  type RecipientCategory,
} from '@wafina/shared';
import { Button, Card, EmptyState, Input, Select } from '@wafina/ui';
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

const ROLE_LABEL: Record<string, string> = {
  Donor: 'Doador',
  Institution: 'Instituição',
  Admin: 'Admin',
  Animal_Shelter: 'Abrigo de Animais',
};

/** Same 3-way derivation the "Estado" column uses — shared so the filter and
 * the default sort order always agree with what's actually on screen. */
function institutionStatus(r: ReportRow): string {
  return r.Verified ? 'Verificada' : r.Rejection_Reason ? 'Rejeitada' : 'Pendente';
}

/** Pilot feedback, 2026-08-05: pending items need attention first; verified
 * ones are already resolved and can sit below. Rejected sits between the
 * two — also resolved, but still worth a glance sooner than a settled case. */
const INSTITUTION_STATUS_PRIORITY: Record<string, number> = { Pendente: 0, Rejeitada: 1, Verificada: 2 };

/** Pilot feedback, 2026-08-05: Donor accounts on top, Institution below. */
const ROLE_PRIORITY: Record<string, number> = { Donor: 0, Institution: 1, Admin: 2 };

type ReportRow = Record<string, unknown>;

function formatNum(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-PT') : String(value ?? '');
}
type Column = {
  label: string;
  get: (row: ReportRow, countryName: (id: string) => string) => string;
  /** Real-device finding, 2026-08-08 — a numeric column left-aligned among text columns read like a raw spreadsheet dump, not a report. Right-aligns and applies thousands separators. */
  numeric?: boolean;
};

/** Real-device finding, 2026-08-04: the export used to dump every internal
 * field (IDs, raw booleans, nested objects) with no labels or chosen order —
 * technically complete, not actually readable. One curated column set per
 * report type, in the order a human would actually want to scan them. */
const REPORT_COLUMNS: Record<string, Column[]> = {
  donations: [
    { label: 'Código', get: (r) => String(r.Public_Donation_Code ?? '') },
    { label: 'Item', get: (r) => String(r.Item_Type ?? '') },
    { label: 'Quantidade', get: (r) => formatNum(r.Quantity), numeric: true },
    { label: 'Estado do item', get: (r) => String(r.Condition ?? '') },
    {
      label: 'Categoria do destinatário',
      get: (r) =>
        RECIPIENT_CATEGORY_LABEL[r.Recipient_Category as keyof typeof RECIPIENT_CATEGORY_LABEL] ??
        String(r.Recipient_Category ?? ''),
    },
    {
      label: 'Método de entrega',
      get: (r) =>
        DELIVERY_METHOD_LABEL[r.Delivery_Method as keyof typeof DELIVERY_METHOD_LABEL] ??
        String(r.Delivery_Method ?? ''),
    },
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
    { label: 'Estado', get: institutionStatus },
    { label: 'Itens recebidos', get: (r) => formatNum(r.Total_Items_Received ?? 0), numeric: true },
  ],
  companies: [
    { label: 'Nome', get: (r) => String(r.Company_Name ?? '') },
    { label: 'País', get: (r) => String(r.Country ?? '') },
    { label: 'Estado', get: (r) => (r.Status === 'Suspended' ? 'Suspensa' : 'Ativa') },
    { label: 'Colaboradores', get: (r) => formatNum(r.Employee_Count ?? 0), numeric: true },
    { label: 'Doações', get: (r) => formatNum(r.Donation_Count ?? 0), numeric: true },
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [recipientCategoryFilter, setRecipientCategoryFilter] = useState<RecipientCategory | 'all'>('all');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState<DeliveryMethod | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  // Filters are per-type (a donation status doesn't mean anything on the
  // Users report), so a stale selection carried over from the previous type
  // would silently filter out everything — reset alongside the reload.
  useEffect(() => {
    setSearch('');
    setStatusFilter('all');
    setCountryFilter('all');
    setRecipientCategoryFilter('all');
    setDeliveryMethodFilter('all');
    setDateFrom('');
    setDateTo('');
  }, [type]);

  const countryName = useMemo(() => {
    const byId = new Map(countries.map((c) => [c.Region_ID, c.Name]));
    return (id: string) => byId.get(id) ?? id;
  }, [countries]);

  const columns = REPORT_COLUMNS[type] ?? [];

  /** Companies report's country filter options — built from what's actually
   * in the loaded rows rather than the full country list, so it never offers
   * a country with zero matching companies. */
  const companyCountryOptions = useMemo(() => {
    if (type !== 'companies' || !rows) return [];
    return Array.from(new Set(rows.map((r) => String(r.Country ?? '')).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt'),
    );
  }, [type, rows]);

  /** Pilot feedback, 2026-08-05: search bar, per-type filter, and a default
   * sort order for the three report types called out by name (Institutions,
   * Users, Impact History) — Donations/Countries already arrive pre-sorted
   * from their service functions, and Companies had no sort requested. */
  const processedRows = useMemo(() => {
    let result = rows ?? [];

    if (type === 'institutions') {
      result = [...result].sort(
        (a, b) => (INSTITUTION_STATUS_PRIORITY[institutionStatus(a)] ?? 99) -
          (INSTITUTION_STATUS_PRIORITY[institutionStatus(b)] ?? 99),
      );
      if (statusFilter !== 'all') result = result.filter((r) => institutionStatus(r) === statusFilter);
    }

    if (type === 'donations') {
      if (statusFilter !== 'all') result = result.filter((r) => r.Status === statusFilter);
      if (recipientCategoryFilter !== 'all') {
        result = result.filter((r) => r.Recipient_Category === recipientCategoryFilter);
      }
      if (deliveryMethodFilter !== 'all') {
        result = result.filter((r) => r.Delivery_Method === deliveryMethodFilter);
      }
      if (dateFrom) result = result.filter((r) => String(r.Date_Submitted ?? '').slice(0, 10) >= dateFrom);
      if (dateTo) result = result.filter((r) => String(r.Date_Submitted ?? '').slice(0, 10) <= dateTo);
    }

    if (type === 'companies') {
      if (countryFilter !== 'all') result = result.filter((r) => r.Country === countryFilter);
    }

    if (type === 'users') {
      result = [...result].sort(
        (a, b) => (ROLE_PRIORITY[String(a.Role)] ?? 99) - (ROLE_PRIORITY[String(b.Role)] ?? 99),
      );
    }

    if (type === 'success-stories') {
      result = [...result].sort((a, b) =>
        String(b.Date_Published ?? '').localeCompare(String(a.Date_Published ?? '')),
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) => columns.some((col) => col.get(row, countryName).toLowerCase().includes(q)));
    }

    return result;
  }, [
    rows,
    type,
    statusFilter,
    countryFilter,
    recipientCategoryFilter,
    deliveryMethodFilter,
    dateFrom,
    dateTo,
    search,
    columns,
    countryName,
  ]);

  /** Pilot feedback, 2026-08-08 — a raw table gives no at-a-glance sense of
   * scale; a quick summary line (count, plus total items for Donations)
   * answers "how much" before scanning any rows. */
  const summaryLabel = useMemo(() => {
    const count = processedRows.length;
    const noun = count === 1 ? 'registo' : 'registos';
    if (type !== 'donations') return `${count} ${noun}`;
    const totalItems = processedRows.reduce((sum, r) => {
      const q = Number(r.Quantity);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);
    return `${count} ${noun} · ${totalItems} itens no total`;
  }, [processedRows, type]);

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

          <Input
            label="Pesquisar"
            placeholder="Pesquisar em todas as colunas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />

          {type === 'donations' && (
            <>
              <Select label="Estado da doação" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Todos</option>
                {DONATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DONATION_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Select
                label="Categoria do destinatário"
                value={recipientCategoryFilter}
                onChange={(e) => setRecipientCategoryFilter(e.target.value as RecipientCategory | 'all')}
              >
                <option value="all">Todas</option>
                {RECIPIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {RECIPIENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
              <Select
                label="Método de entrega"
                value={deliveryMethodFilter}
                onChange={(e) => setDeliveryMethodFilter(e.target.value as DeliveryMethod | 'all')}
              >
                <option value="all">Todos</option>
                {DELIVERY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {DELIVERY_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
              <Input label="Submetida desde" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input label="Submetida até" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </>
          )}

          {type === 'institutions' && (
            <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Rejeitada">Rejeitada</option>
              <option value="Verificada">Verificada</option>
            </Select>
          )}

          {type === 'companies' && (
            <Select label="País" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="all">Todos</option>
              {companyCountryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}

          <Button
            variant="secondary"
            disabled={processedRows.length === 0}
            onClick={() => downloadCsv(`wafina-${type}.csv`, toCsv(columns, processedRows, countryName))}
          >
            Exportar CSV
          </Button>
        </div>

        {rows === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {rows && rows.length > 0 && processedRows.length === 0 && (
          <EmptyState title="Sem resultados" description="Nenhum registo corresponde aos filtros aplicados." icon="bar-chart" />
        )}
        {rows?.length === 0 && <EmptyState title="Sem dados" description="Não há registos para este relatório." icon="bar-chart" />}
        {processedRows.length > 0 && (
          <>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600 }}>{summaryLabel}</p>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 13 }}>
                  <thead>
                    <tr>
                      {columns.map((col, ci) => (
                        <th
                          key={col.label}
                          style={{
                            textAlign: col.numeric ? 'right' : 'left',
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--color-border)',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                            color: 'var(--color-text-muted)',
                            position: ci === 0 ? 'sticky' : undefined,
                            left: ci === 0 ? 0 : undefined,
                            background: 'var(--color-surface)',
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 1 ? 'var(--color-surface-2, rgba(0,0,0,0.02))' : 'transparent' }}>
                        {columns.map((col, ci) => (
                          <td
                            key={col.label}
                            style={{
                              padding: '9px 12px',
                              borderBottom: '1px solid var(--color-border)',
                              whiteSpace: 'nowrap',
                              textAlign: col.numeric ? 'right' : 'left',
                              fontWeight: ci === 0 ? 600 : 400,
                              position: ci === 0 ? 'sticky' : undefined,
                              left: ci === 0 ? 0 : undefined,
                              background: ci === 0 ? 'inherit' : undefined,
                            }}
                          >
                            {col.get(row, countryName)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
