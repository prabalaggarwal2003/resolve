import type {
  BudgetDashboard,
  BudgetDashboardLayout,
  BudgetDataContext,
  BudgetWidgetFilters,
} from './budgetWidgets';

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

export function filtersToQuery(filters: BudgetWidgetFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export type BudgetAnalyticsResponse = BudgetDataContext;

export async function fetchBudgetAnalytics(pageFilters: Record<string, string> = {}): Promise<BudgetAnalyticsResponse> {
  const res = await fetch(api(`/api/budget-dashboard/data${filtersToQuery(pageFilters)}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load budget analytics');
  return data;
}

export async function fetchBudgetDashboards(): Promise<BudgetDashboard[]> {
  const res = await fetch(api('/api/budget-dashboard/dashboards'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboards');
  return data.dashboards || [];
}

export async function fetchBudgetDashboard(id: string): Promise<BudgetDashboard> {
  const res = await fetch(api(`/api/budget-dashboard/dashboards/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboard');
  return data.dashboard;
}

export async function createBudgetDashboard(payload: Partial<BudgetDashboard>): Promise<BudgetDashboard> {
  const res = await fetch(api('/api/budget-dashboard/dashboards'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create dashboard');
  return data.dashboard;
}

export async function updateBudgetDashboard(id: string, payload: Partial<BudgetDashboard>): Promise<BudgetDashboard> {
  const res = await fetch(api(`/api/budget-dashboard/dashboards/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update dashboard');
  return data.dashboard;
}

export async function duplicateBudgetDashboard(id: string, name?: string): Promise<BudgetDashboard> {
  const res = await fetch(api(`/api/budget-dashboard/dashboards/${id}/duplicate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to duplicate dashboard');
  return data.dashboard;
}

export async function deleteBudgetDashboard(id: string): Promise<void> {
  const res = await fetch(api(`/api/budget-dashboard/dashboards/${id}`), { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete dashboard');
  }
}

export async function fetchActiveBudgetDashboardId(): Promise<string | null> {
  const res = await fetch(api('/api/users/me/preferences/budget-dashboard'), { headers: authHeaders() });
  const data = await res.json();
  return data.activeDashboardId || null;
}

export async function saveActiveBudgetDashboardId(id: string | null): Promise<void> {
  await fetch(api('/api/users/me/preferences/budget-dashboard'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ activeDashboardId: id }),
  });
}

export const AUTO_REFRESH_OPTIONS = [
  { id: 'manual' as const, label: 'Manual', ms: 0 },
  { id: '1m' as const, label: '1 min', ms: 60_000 },
  { id: '5m' as const, label: '5 min', ms: 300_000 },
  { id: '15m' as const, label: '15 min', ms: 900_000 },
];
