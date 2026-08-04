export type ReportOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'is_empty'
  | 'is_not_empty';

export type ReportFieldRef = {
  source: string;
  key: string;
  label?: string;
  pinned?: boolean;
  order?: number;
};

export type ReportFilterCondition = {
  source?: string;
  field: string;
  op: ReportOperator | string;
  value?: unknown;
  valueTo?: unknown;
};

export type ReportFilterGroup = {
  logic: 'and' | 'or';
  conditions: ReportFilterCondition[];
  groups?: ReportFilterGroup[];
};

export type ReportConfig = {
  primarySource: string;
  dataSources: string[];
  fields: ReportFieldRef[];
  filters: ReportFilterGroup;
  groupBy: { source: string; key: string }[];
  sort: { source: string; key: string; dir: 'asc' | 'desc' }[];
  calculations: { id: string; type: string; field: string; source?: string; label?: string }[];
  visualization: { type: string; options?: Record<string, unknown> };
  formatting?: Record<string, unknown>;
  exportOptions?: Record<string, unknown> & { builderStep?: number };
};

export type CatalogField = {
  key: string;
  label: string;
  type: string;
  source: string;
  custom?: boolean;
  groupable?: boolean;
  aggregatable?: boolean;
  virtual?: boolean;
  options?: unknown[];
};

export type CatalogSource = {
  key: string;
  label: string;
  description?: string;
  fields: CatalogField[];
};

export type ReportCatalog = {
  sources: CatalogSource[];
  operators: { key: string; label: string; types: string[] }[];
  calculations: { key: string; label: string }[];
  visualizations: { key: string; label: string }[];
  exportFormats: string[];
  defaultFormatting: Record<string, unknown>;
  quickReports: { key: string; name: string; category: string; description: string }[];
};

export type ReportDefinition = {
  _id: string;
  name: string;
  description?: string;
  kind: 'saved' | 'template' | 'draft' | 'quick';
  scope: 'user' | 'organization' | 'system';
  category?: string;
  quickKey?: string;
  favouriteBy?: string[];
  published?: boolean;
  config: ReportConfig;
  lastRunAt?: string;
  runCount?: number;
  updatedAt?: string;
  createdAt?: string;
};

export type ReportRunResult = {
  primarySource: string;
  total: number;
  page: number;
  limit: number;
  columns: { key: string; label: string; source: string }[];
  rows: Record<string, unknown>[];
  groups: { group: string; count: number }[] | null;
  aggregates: { id: string; type: string; field: string; label: string; value: unknown }[];
  chart: { type: string; labels: string[]; values: number[] } | null;
  visualization: string;
};

export function emptyReportConfig(primarySource = 'assets'): ReportConfig {
  return {
    primarySource,
    dataSources: [primarySource],
    fields: [],
    filters: { logic: 'and', conditions: [] },
    groupBy: [],
    sort: [],
    calculations: [],
    visualization: { type: 'table', options: {} },
    formatting: {},
    exportOptions: {},
  };
}

/** Ensure config is a plain, schema-safe object before API writes. */
export function sanitizeReportConfig(config: ReportConfig): ReportConfig {
  const base = config || emptyReportConfig();
  const calcs = Array.isArray(base.calculations) ? base.calculations : [];
  return {
    primarySource: base.primarySource || 'assets',
    dataSources: Array.isArray(base.dataSources) && base.dataSources.length
      ? [...base.dataSources]
      : [base.primarySource || 'assets'],
    fields: Array.isArray(base.fields) ? base.fields.map((f) => ({ ...f })) : [],
    filters: base.filters
      ? {
          logic: base.filters.logic === 'or' ? 'or' : 'and',
          conditions: Array.isArray(base.filters.conditions)
            ? base.filters.conditions.map((c) => ({ ...c }))
            : [],
          groups: Array.isArray(base.filters.groups) ? base.filters.groups : [],
        }
      : { logic: 'and', conditions: [] },
    groupBy: Array.isArray(base.groupBy) ? base.groupBy.map((g) => ({ ...g })) : [],
    sort: Array.isArray(base.sort) ? base.sort.map((s) => ({ ...s })) : [],
    calculations: calcs.map((c, i) => ({
      id: String(c?.id || `c${i}`),
      type: String(c?.type || 'count'),
      field: String(c?.field || ''),
      ...(c?.source ? { source: String(c.source) } : {}),
      ...(c?.label ? { label: String(c.label) } : {}),
    })),
    visualization: {
      type: String(base.visualization?.type || 'table'),
      options:
        base.visualization?.options && typeof base.visualization.options === 'object'
          ? { ...base.visualization.options }
          : {},
    },
    formatting:
      base.formatting && typeof base.formatting === 'object' ? { ...base.formatting } : {},
    exportOptions:
      base.exportOptions && typeof base.exportOptions === 'object'
        ? { ...base.exportOptions }
        : {},
  };
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || 'Request failed');
  return data as T;
}

export async function fetchReportCatalog() {
  const res = await fetch(api('/api/report-studio/catalog'), { headers: authHeaders() });
  return parse<ReportCatalog>(res);
}

export async function fetchReportDashboard() {
  const res = await fetch(api('/api/report-studio/dashboard'), { headers: authHeaders() });
  return parse<Record<string, unknown>>(res);
}

export async function fetchQuickReports() {
  const res = await fetch(api('/api/report-studio/quick'), { headers: authHeaders() });
  return parse<{ reports: ReportCatalog['quickReports'] }>(res);
}

export async function fetchQuickReport(key: string) {
  const res = await fetch(api(`/api/report-studio/quick/${key}`), { headers: authHeaders() });
  return parse<{ key: string; name: string; category: string; description: string; config: ReportConfig }>(res);
}

export async function runReport(config: ReportConfig, opts?: { page?: number; limit?: number; reportId?: string }) {
  const res = await fetch(api('/api/report-studio/run'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ config, ...opts }),
  });
  return parse<ReportRunResult>(res);
}

export async function exportReport(payload: {
  config: ReportConfig;
  format: string;
  reportName: string;
  reportId?: string;
}) {
  const res = await fetch(api('/api/report-studio/export'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return parse<{
    export: { _id: string; fileName: string; format: string; recordCount: number };
    download: { fileName: string; contentType: string; content: string; encoding?: string };
  }>(res);
}

export function downloadTextFile(
  fileName: string,
  content: string,
  contentType: string,
  encoding?: string
) {
  let blob: Blob;
  const isBase64 = encoding === 'base64' || contentType.includes('application/pdf');
  if (isBase64) {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: contentType || 'application/pdf' });
  } else {
    blob = new Blob([content], { type: contentType || 'text/plain' });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchFieldValues(source: string, field: string, q = '') {
  const qs = new URLSearchParams({ source, field, q });
  const res = await fetch(api(`/api/report-studio/field-values?${qs}`), { headers: authHeaders() });
  return parse<{ values: { value: string; count: number }[] }>(res);
}

export async function fetchDefinitions(kind?: string) {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await fetch(api(`/api/report-studio/definitions${qs}`), { headers: authHeaders() });
  return parse<{ definitions: ReportDefinition[] }>(res);
}

export async function fetchDefinition(id: string) {
  const res = await fetch(api(`/api/report-studio/definitions/${id}`), { headers: authHeaders() });
  return parse<ReportDefinition>(res);
}

export async function saveDefinition(body: Partial<ReportDefinition> & { config: ReportConfig }) {
  const res = await fetch(api('/api/report-studio/definitions'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<ReportDefinition>(res);
}

export async function updateDefinition(id: string, body: Partial<ReportDefinition>) {
  const res = await fetch(api(`/api/report-studio/definitions/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<ReportDefinition>(res);
}

export async function duplicateDefinition(id: string, kind?: string) {
  const res = await fetch(api(`/api/report-studio/definitions/${id}/duplicate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ kind }),
  });
  return parse<ReportDefinition>(res);
}

export async function deleteDefinition(id: string) {
  const res = await fetch(api(`/api/report-studio/definitions/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parse<{ ok: boolean }>(res);
}

export async function toggleFavourite(id: string) {
  const res = await fetch(api(`/api/report-studio/definitions/${id}/favourite`), {
    method: 'POST',
    headers: authHeaders(),
  });
  return parse<{ favourite: boolean }>(res);
}

export async function saveQuickAs(key: string, kind: 'saved' | 'template', name?: string) {
  const res = await fetch(api(`/api/report-studio/quick/${key}/save`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ kind, name }),
  });
  return parse<ReportDefinition>(res);
}

export async function fetchSchedules() {
  const res = await fetch(api('/api/report-studio/schedules'), { headers: authHeaders() });
  return parse<{ schedules: Record<string, unknown>[] }>(res);
}

export async function createSchedule(body: Record<string, unknown>) {
  const res = await fetch(api('/api/report-studio/schedules'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<Record<string, unknown>>(res);
}

export async function updateSchedule(id: string, body: Record<string, unknown>) {
  const res = await fetch(api(`/api/report-studio/schedules/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<Record<string, unknown>>(res);
}

export async function deleteSchedule(id: string) {
  const res = await fetch(api(`/api/report-studio/schedules/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parse<{ ok: boolean }>(res);
}

export async function fetchExports(params?: { search?: string; format?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.format) qs.set('format', params.format);
  const res = await fetch(api(`/api/report-studio/exports?${qs}`), { headers: authHeaders() });
  return parse<{ exports: Record<string, unknown>[] }>(res);
}

export async function downloadExport(id: string) {
  const res = await fetch(api(`/api/report-studio/exports/${id}/download`), { headers: authHeaders() });
  return parse<{ fileName: string; contentType: string; content: string; encoding?: string }>(res);
}

export async function fetchReportSettings() {
  const res = await fetch(api('/api/report-studio/settings'), { headers: authHeaders() });
  return parse<Record<string, unknown>>(res);
}

export async function updateReportSettings(body: Record<string, unknown>) {
  const res = await fetch(api('/api/report-studio/settings'), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parse<Record<string, unknown>>(res);
}
