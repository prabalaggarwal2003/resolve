import type { KpiAssetMetrics, KpiDashboard, KpiQuickData, KpiTotals, KpiWidgetFilters } from './kpiWidgets';

export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function filtersToQuery(filters: KpiWidgetFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export type KpiSummaryResponse = {
  assets: KpiAssetMetrics[];
  totals: KpiTotals;
  quick: KpiQuickData;
};

export async function fetchKpiSummary(pageFilters: KpiWidgetFilters = {}): Promise<KpiSummaryResponse> {
  const res = await fetch(api(`/api/kpis/summary${filtersToQuery(pageFilters)}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load KPI data');
  return data;
}

export async function fetchKpiDashboards(): Promise<KpiDashboard[]> {
  const res = await fetch(api('/api/kpis/dashboards'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboards');
  return data.dashboards || [];
}

export async function fetchKpiDashboard(id: string): Promise<KpiDashboard> {
  const res = await fetch(api(`/api/kpis/dashboards/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboard');
  return data.dashboard;
}

export async function createKpiDashboard(payload: Partial<KpiDashboard>): Promise<KpiDashboard> {
  const res = await fetch(api('/api/kpis/dashboards'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create dashboard');
  return data.dashboard;
}

export async function updateKpiDashboard(id: string, payload: Partial<KpiDashboard>): Promise<KpiDashboard> {
  const res = await fetch(api(`/api/kpis/dashboards/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update dashboard');
  return data.dashboard;
}

export async function duplicateKpiDashboard(id: string, name?: string): Promise<KpiDashboard> {
  const res = await fetch(api(`/api/kpis/dashboards/${id}/duplicate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to duplicate dashboard');
  return data.dashboard;
}

export async function deleteKpiDashboard(id: string): Promise<void> {
  const res = await fetch(api(`/api/kpis/dashboards/${id}`), { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete dashboard');
  }
}

export async function fetchActiveKpiDashboardId(): Promise<string | null> {
  const res = await fetch(api('/api/users/me/preferences/kpi-dashboard'), { headers: authHeaders() });
  const data = await res.json();
  return data.activeDashboardId || null;
}

export async function saveActiveKpiDashboardId(id: string | null): Promise<void> {
  await fetch(api('/api/users/me/preferences/kpi-dashboard'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ activeDashboardId: id }),
  });
}

export const AUTO_REFRESH_OPTIONS = [
  { id: 'manual', label: 'Manual', ms: 0 },
  { id: '1m', label: 'Every 1 minute', ms: 60_000 },
  { id: '5m', label: 'Every 5 minutes', ms: 300_000 },
  { id: '15m', label: 'Every 15 minutes', ms: 900_000 },
] as const;
